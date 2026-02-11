import { AIProvider } from '../types'

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

export const DEFAULT_ICON_PROMPT = `You are an icon naming assistant. Given an icon image and its current name, return a comma-separated list of 10-15 alternative names.

Analyze the icon visually—don't rely solely on the provided name, which may be inaccurate or overly specific. Think laterally: what concepts, actions, or contexts does this icon evoke? What might a designer search for when looking for this icon?

Include:
- What the icon literally depicts
- Actions or concepts it commonly represents in UI
- Terms designers might search for in icon libraries

Return ONLY the comma-separated list. Lowercase, single words preferred. No articles or prepositions.

Icon name: {icon_name}`

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

export function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case 'chatgpt':
      return 'ChatGPT'
    case 'claude':
      return 'Claude'
    case 'gemini':
      return 'Gemini'
    default:
      return provider
  }
}

export function buildPrompt(
  componentName: string,
  componentType: string,
  properties: string[],
  parentName?: string,
  customPrompt?: string,
  customVariantPrompt?: string,
  options?: { isIcon?: boolean; customIconPrompt?: string }
): string {
  const propsString = properties.length > 0 ? properties.join(', ') : 'None'

  if (options?.isIcon) {
    const template = options.customIconPrompt || DEFAULT_ICON_PROMPT
    return template.replace(/{icon_name}/g, componentName)
  }

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

export async function generateDescription(
  provider: AIProvider,
  apiKey: string,
  componentName: string,
  componentType: string,
  properties: string[],
  parentName?: string,
  customPrompt?: string,
  customVariantPrompt?: string,
  imageBase64?: string,
  iconOptions?: { isIcon?: boolean; customIconPrompt?: string }
): Promise<string> {
  const prompt = buildPrompt(componentName, componentType, properties, parentName, customPrompt, customVariantPrompt, iconOptions)

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
