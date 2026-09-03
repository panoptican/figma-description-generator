import { AIProvider, VariantContext } from '../types'

export const GEMINI_MODEL = 'gemini-3.6-flash'
export const CLAUDE_MODEL = 'claude-haiku-4-5'
export const OPENAI_MODEL = 'gpt-5.6-luna'

export const DEFAULT_PROMPT = `Write a brief description for a design system component.

Component name: {name}
Type: {type}
Properties: {properties}

Rules:
- 1-2 sentences maximum
- Never start with "This component" or "A component that"
- Describe what it does and when to use it directly
- When complete variant set context is provided, describe the range or variation the set defines
- Write like Shopify Polaris documentation (e.g. "Displays a list of actions..." or "Provides navigation between pages...")

Output only the description text.`

export const DEFAULT_ICON_PROMPT = `You are an icon naming assistant. Given an icon image, its current name, and (when present) its parent component, return a comma-separated list of 10-15 alternative names.

Analyze the icon visually—don't rely solely on the provided name, which may be inaccurate or overly specific. Think laterally: what concepts, actions, or contexts does this icon evoke? What might a designer search for when looking for this icon?

Include:
- What the icon literally depicts
- Actions or concepts it commonly represents in UI
- Terms designers might search for in icon libraries

Return ONLY the comma-separated list. Lowercase, single words preferred. No articles or prepositions.

Icon name: {icon_name}
Parent component: {parentName}`

export const DEFAULT_VARIANT_PROMPT = `Write a brief description for a component variant.

Parent component: {parentName}
Variant: {name}
Properties: {properties}

Rules:
- 1 sentence maximum
- Never start with "This variant" or "A variant that"
- Explain what makes this variant different and when to use it
- Use the complete variant set context to understand this variant's position and role in the set
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
  options?: { isIcon?: boolean; customIconPrompt?: string },
  variantContext?: VariantContext[]
): string {
  const propsString = properties.length > 0 ? properties.join(', ') : 'None'
  let prompt: string

  if (options?.isIcon) {
    const template = options.customIconPrompt || DEFAULT_ICON_PROMPT
    prompt = addParentContext(
      template
        .replace(/{icon_name}/g, componentName)
        .replace(/{parentName}/g, parentName || 'None'),
      template,
      parentName
    )
  } else if (componentType === 'VARIANT') {
    const template = customVariantPrompt || DEFAULT_VARIANT_PROMPT
    prompt = addParentContext(template
      .replace(/{parentName}/g, parentName || 'Unknown parent component')
      .replace(/{name}/g, componentName)
      .replace(/{properties}/g, propsString),
      template,
      parentName
    )
  } else {
    const template = customPrompt || DEFAULT_PROMPT
    prompt = template
      .replace(/{name}/g, componentName)
      .replace(/{type}/g, componentType)
      .replace(/{properties}/g, propsString)
  }

  return options?.isIcon ? prompt : addVariantContext(prompt, variantContext)
}

function addParentContext(prompt: string, template: string, parentName?: string): string {
  if (!parentName || template.includes('{parentName}')) {
    return prompt
  }

  return `${prompt}\n\nParent component: ${parentName}`
}

function addVariantContext(prompt: string, variantContext?: VariantContext[]): string {
  if (!variantContext || variantContext.length === 0) {
    return prompt
  }

  const variants = variantContext
    .map(({ name, properties }) => {
      const props = properties.length > 0 ? properties.join(', ') : 'No parsed properties'
      return `- ${name}: ${props}`
    })
    .join('\n')

  return `${prompt}\n\nComplete variant set context:\n${variants}`
}

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  imageBase64?: string,
  abortSignal?: AbortSignal
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts
        }]
      }),
      signal: abortSignal
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
  imageBase64?: string,
  abortSignal?: AbortSignal
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
      model: CLAUDE_MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: imageBase64 ? content : prompt
      }]
    }),
    signal: abortSignal
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
  imageBase64?: string,
  abortSignal?: AbortSignal
): Promise<string> {
  type ContentPart =
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string }
  const content: ContentPart[] = []

  if (imageBase64) {
    content.push({
      type: 'input_image',
      image_url: `data:image/png;base64,${imageBase64}`
    })
  }
  content.push({ type: 'input_text', text: prompt })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_output_tokens: 256,
      input: [{
        role: 'user',
        content
      }]
    }),
    signal: abortSignal
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`ChatGPT API error: ${error}`)
  }

  const data = await response.json()
  const text = data.output_text || data.output
    ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
    .find((item: { type?: string; text?: string }) => item.type === 'output_text')?.text

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
  iconOptions?: { isIcon?: boolean; customIconPrompt?: string },
  variantContext?: VariantContext[],
  abortSignal?: AbortSignal
): Promise<string> {
  const prompt = buildPrompt(
    componentName,
    componentType,
    properties,
    parentName,
    customPrompt,
    customVariantPrompt,
    iconOptions,
    variantContext
  )

  switch (provider) {
    case 'gemini':
      return generateWithGemini(apiKey, prompt, imageBase64, abortSignal)
    case 'claude':
      return generateWithClaude(apiKey, prompt, imageBase64, abortSignal)
    case 'chatgpt':
      return generateWithChatGPT(apiKey, prompt, imageBase64, abortSignal)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
