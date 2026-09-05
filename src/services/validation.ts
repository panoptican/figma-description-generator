import { AIProvider } from '../types'

export type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid'

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate an API key by making a lightweight API call to the provider.
 * - ChatGPT: Uses models list endpoint (no tokens consumed)
 * - Claude: Uses the authenticated models endpoint (no generation)
 * - Gemini: Uses models list endpoint (no tokens consumed)
 */
export async function validateApiKey(
  provider: AIProvider,
  apiKey: string
): Promise<ValidationResult> {
  if (!apiKey.trim()) {
    return { valid: false, error: 'API key is required' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    switch (provider) {
      case 'chatgpt':
        return await validateChatGPT(apiKey, controller.signal)
      case 'claude':
        return await validateClaude(apiKey, controller.signal)
      case 'openrouter':
        return await validateOpenRouter(apiKey, controller.signal)
      case 'gemini':
        return await validateGemini(apiKey, controller.signal)
      default:
        return { valid: false, error: `Unknown provider: ${provider}` }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, error: 'Validation timed out after 5 seconds' }
    }
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  } finally {
    clearTimeout(timeout)
  }
}

async function validateChatGPT(apiKey: string, signal: AbortSignal): Promise<ValidationResult> {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    signal
  })

  if (response.ok) {
    return { valid: true }
  }

  const errorText = await response.text()
  return parseOpenAIError(response.status, errorText)
}

async function validateOpenRouter(apiKey: string, signal: AbortSignal): Promise<ValidationResult> {
  const response = await fetch('https://openrouter.ai/api/v1/key', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    signal
  })
  if (response.ok) return { valid: true }
  return parseOpenAIError(response.status, await response.text())
}

async function validateClaude(apiKey: string, signal: AbortSignal): Promise<ValidationResult> {
  const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    signal
  })

  if (response.ok) {
    return { valid: true }
  }

  const errorText = await response.text()
  return parseClaudeError(response.status, errorText)
}

async function validateGemini(apiKey: string, signal: AbortSignal): Promise<ValidationResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    {
      method: 'GET',
      signal
    }
  )

  if (response.ok) {
    return { valid: true }
  }

  const errorText = await response.text()
  return parseGeminiError(response.status, errorText)
}

function parseOpenAIError(status: number, errorText: string): ValidationResult {
  try {
    const error = JSON.parse(errorText)
    const message = error.error?.message || errorText

    if (status === 401) {
      return { valid: false, error: 'Invalid API key' }
    }
    if (status === 429) {
      return { valid: false, error: 'Rate limited - try again later' }
    }
    return { valid: false, error: message }
  } catch {
    return { valid: false, error: `HTTP ${status}: ${errorText}` }
  }
}

function parseClaudeError(status: number, errorText: string): ValidationResult {
  try {
    const error = JSON.parse(errorText)
    const message = error.error?.message || errorText

    if (status === 401) {
      return { valid: false, error: 'Invalid API key' }
    }
    if (status === 403) {
      return { valid: false, error: 'API key does not have access' }
    }
    if (status === 429) {
      return { valid: false, error: 'Rate limited - try again later' }
    }
    return { valid: false, error: message }
  } catch {
    return { valid: false, error: `HTTP ${status}: ${errorText}` }
  }
}

function parseGeminiError(status: number, errorText: string): ValidationResult {
  try {
    const error = JSON.parse(errorText)
    const message = error.error?.message || errorText

    if (status === 400 && message.includes('API key')) {
      return { valid: false, error: 'Invalid API key' }
    }
    if (status === 403) {
      return { valid: false, error: 'API key does not have access' }
    }
    if (status === 429) {
      return { valid: false, error: 'Rate limited - try again later' }
    }
    return { valid: false, error: message }
  } catch {
    return { valid: false, error: `HTTP ${status}: ${errorText}` }
  }
}
