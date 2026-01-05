import { AIProvider } from '../types'

export const DEFAULT_PROMPT = `Generate a concise, professional description for a Figma design component.

Component name: {name}
Component type: {type}
Properties: {properties}

Write a clear description that explains what this component is and when to use it. Keep it under 1-2 sentences. Only output the description text, nothing else.`

export const DEFAULT_VARIANT_PROMPT = `Generate a concise, professional description for a Figma design component variant.

Parent component: {parentName}
Variant name: {name}
Properties: {properties}

This is a variant of the "{parentName}" component. Write a clear description that explains what this specific variant does and when to use it instead of other variants. Keep it under 1-2 sentences. Only output the description text, nothing else.`

function buildPrompt(
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
  prompt: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
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
  prompt: string
): Promise<string> {
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
        content: prompt
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
  prompt: string
): Promise<string> {
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
        content: prompt
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
  customVariantPrompt?: string
): Promise<string> {
  const prompt = buildPrompt(componentName, componentType, properties, parentName, customPrompt, customVariantPrompt)

  switch (provider) {
    case 'gemini':
      return generateWithGemini(apiKey, prompt)
    case 'claude':
      return generateWithClaude(apiKey, prompt)
    case 'chatgpt':
      return generateWithChatGPT(apiKey, prompt)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
