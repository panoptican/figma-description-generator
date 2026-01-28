import { AIProvider, ProviderConfig } from '../types'
import { withRetry, RetryError } from '../utils/retry'
import { shouldFallback, getProviderChain, getProviderDisplayName } from './fallback'

export interface GenerateOptions {
  onRetry?: (attempt: number, maxAttempts: number, error: Error) => void
  shouldAbort?: () => boolean
}

export interface GenerateResult {
  description: string
  attempts: number
  fromRetry: boolean
}

export interface GenerateWithFallbackResult {
  description: string
  usedProvider: AIProvider
  fallbackUsed: boolean
  totalAttempts: number
}

export interface FallbackOptions extends GenerateOptions {
  providerChain?: ProviderConfig[]
  enableFallback?: boolean
  onProviderAttempt?: (provider: AIProvider) => void
  onProviderFailed?: (provider: AIProvider, error: Error) => void
}

export { RetryError, getProviderDisplayName }

export const DEFAULT_PROMPT = `Write a brief description for a design system component.

Component name: {name}
Type: {type}
Properties: {properties}

Rules:
- 1-2 sentences maximum
- Never start with "This component" or "A component that"
- Describe what it does and when to use it directly
- Write like Shopify Polaris documentation (e.g. "Displays a list of actions..." or "Provides navigation between pages...")

Output only the description text.`

export const DEFAULT_VARIANT_PROMPT = `Write a brief description for a component variant.

Parent component: {parentName}
Variant: {name}
Properties: {properties}

Rules:
- 1 sentence maximum
- Never start with "This variant" or "A variant that"
- Explain what makes this variant different and when to use it
- Be direct (e.g. "Used for destructive actions like delete" or "Displays in a compact size for dense layouts")

Output only the description text.`

export function buildPrompt(
  componentName: string,
  componentType: string,
  properties: string[],
  parentName?: string,
  customPrompt?: string,
  customVariantPrompt?: string
): string {
  const propsString = properties.length > 0 ? properties.join(', ') : 'None'

  if (componentType === 'VARIANT' && parentName) {
    const template = customVariantPrompt || DEFAULT_VARIANT_PROMPT
    return template
      .replace(/{parentName}/g, parentName)
      .replace(/{name}/g, componentName)
      .replace(/{properties}/g, propsString)
  }

  const template = customPrompt || DEFAULT_PROMPT
  return template
    .replace(/{name}/g, componentName)
    .replace(/{type}/g, componentType)
    .replace(/{properties}/g, propsString)
}

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  imageBase64?: string
): Promise<string> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: imageBase64
      }
    })
  }
  parts.push({ text: prompt })

  const model = imageBase64 ? 'gemini-1.5-flash' : 'gemini-pro'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts
        }]
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('No response from Gemini')
  }

  return text.trim()
}

async function generateWithClaude(
  apiKey: string,
  prompt: string,
  imageBase64?: string
): Promise<string> {
  type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  const content: ContentBlock[] = []

  if (imageBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: imageBase64
      }
    })
  }
  content.push({ type: 'text', text: prompt })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: imageBase64 ? content : prompt
      }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text

  if (!text) {
    throw new Error('No response from Claude')
  }

  return text.trim()
}

async function generateWithChatGPT(
  apiKey: string,
  prompt: string,
  imageBase64?: string
): Promise<string> {
  type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  let content: string | ContentPart[] = prompt

  if (imageBase64) {
    content = [
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${imageBase64}`
        }
      },
      { type: 'text', text: prompt }
    ]
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content
      }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`ChatGPT API error: ${error}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('No response from ChatGPT')
  }

  return text.trim()
}

async function generateDescriptionInternal(
  provider: AIProvider,
  apiKey: string,
  prompt: string,
  imageBase64?: string
): Promise<string> {
  switch (provider) {
    case 'gemini':
      return generateWithGemini(apiKey, prompt, imageBase64)
    case 'claude':
      return generateWithClaude(apiKey, prompt, imageBase64)
    case 'chatgpt':
      return generateWithChatGPT(apiKey, prompt, imageBase64)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Generate description with automatic retry on retryable errors.
 * Returns extended result with attempt count and retry status.
 */
export async function generateDescriptionWithRetry(
  provider: AIProvider,
  apiKey: string,
  componentName: string,
  componentType: string,
  properties: string[],
  parentName?: string,
  customPrompt?: string,
  customVariantPrompt?: string,
  imageBase64?: string,
  options?: GenerateOptions
): Promise<GenerateResult> {
  const prompt = buildPrompt(componentName, componentType, properties, parentName, customPrompt, customVariantPrompt)

  const result = await withRetry(
    () => generateDescriptionInternal(provider, apiKey, prompt, imageBase64),
    {
      maxAttempts: 3,
      baseDelayMs: 1000,
      onRetry: options?.onRetry,
      shouldAbort: options?.shouldAbort
    }
  )

  return {
    description: result.data,
    attempts: result.attempts,
    fromRetry: result.fromRetry
  }
}

/**
 * Generate description (legacy interface for backward compatibility).
 * For retry support, use generateDescriptionWithRetry instead.
 */
export async function generateDescription(
  provider: AIProvider,
  apiKey: string,
  componentName: string,
  componentType: string,
  properties: string[],
  parentName?: string,
  customPrompt?: string,
  customVariantPrompt?: string,
  imageBase64?: string
): Promise<string> {
  const prompt = buildPrompt(componentName, componentType, properties, parentName, customPrompt, customVariantPrompt)
  return generateDescriptionInternal(provider, apiKey, prompt, imageBase64)
}

/**
 * Generate description with fallback provider chain.
 * Tries each provider in the chain until one succeeds.
 * Only falls back on availability errors, not auth errors.
 */
export async function generateDescriptionWithFallback(
  primaryProvider: AIProvider,
  primaryApiKey: string,
  componentName: string,
  componentType: string,
  properties: string[],
  parentName?: string,
  customPrompt?: string,
  customVariantPrompt?: string,
  imageBase64?: string,
  options?: FallbackOptions
): Promise<GenerateWithFallbackResult> {
  const prompt = buildPrompt(componentName, componentType, properties, parentName, customPrompt, customVariantPrompt)

  // Get the provider chain
  const chain = options?.enableFallback
    ? getProviderChain(options.providerChain, primaryProvider, primaryApiKey)
    : [{ provider: primaryProvider, apiKey: primaryApiKey }]

  if (chain.length === 0) {
    throw new Error('No providers configured with valid API keys')
  }

  let totalAttempts = 0
  let lastError: Error | null = null
  let fallbackUsed = false

  for (let i = 0; i < chain.length; i++) {
    const { provider, apiKey } = chain[i]

    // Check if we should abort
    if (options?.shouldAbort?.()) {
      throw new Error('Generation aborted')
    }

    // Notify about provider attempt
    if (i > 0) {
      fallbackUsed = true
    }
    options?.onProviderAttempt?.(provider)

    try {
      const result = await withRetry(
        () => generateDescriptionInternal(provider, apiKey, prompt, imageBase64),
        {
          maxAttempts: 3,
          baseDelayMs: 1000,
          onRetry: options?.onRetry,
          shouldAbort: options?.shouldAbort
        }
      )

      totalAttempts += result.attempts

      return {
        description: result.data,
        usedProvider: provider,
        fallbackUsed,
        totalAttempts
      }
    } catch (error) {
      totalAttempts += 3 // Max retry attempts were used
      lastError = error instanceof Error ? error : new Error(String(error))

      options?.onProviderFailed?.(provider, lastError)

      // Check if we should try the next provider
      const isLastProvider = i === chain.length - 1
      if (!isLastProvider && shouldFallback(lastError)) {
        // Continue to next provider
        continue
      }

      // Either this is the last provider, or the error is not fallback-worthy
      throw lastError
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('All providers failed')
}
