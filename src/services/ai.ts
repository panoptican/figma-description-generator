import { VariantContext } from '../types'

export type Plan = 'free' | 'pro'

export interface Usage {
  plan: Plan
  used: number
  limit: number
  period: string | null
  resetsAt: string | null
}

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

  return addVariantContext(prompt, variantContext)
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
    .map(({ name }) => `- ${name}`)
    .join('\n')

  return `${prompt}\n\nComplete variant set context (names only):\n${variants}\n\nUse these names as context. Return only the requested item's description, not a list of descriptions for other variants. Any attached image shows the requested item.`
}

// The plugin's own generation service. It holds the model key and forwards to Gemini 3.5 Flash-Lite.
// Change this together with networkAccess.allowedDomains in package.json; a test keeps them aligned.
export const GENERATION_ENDPOINT = 'https://description-generator.spidleweb.workers.dev/generate'
const MAX_RETRIES = 2
const DEFAULT_RETRY_SECONDS = 5
const MAX_RETRY_SECONDS = 15

export interface GenerationInput {
  componentName: string
  componentType: string
  properties: string[]
  parentName?: string
  customPrompt?: string
  customVariantPrompt?: string
  imageBase64?: string
  iconOptions?: { isIcon?: boolean; customIconPrompt?: string }
  variantContext?: VariantContext[]
  paymentToken: string
  abortSignal?: AbortSignal
}

export interface GenerationResult {
  description: string
  usage: Usage
}

export class TokenError extends Error {
  constructor() {
    super('Your Figma session could not be verified. Reopen the plugin and try again.')
    this.name = 'TokenError'
  }
}

export class QuotaExceededError extends Error {
  constructor(public readonly usage: Usage, message: string) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

function abortError(): Error {
  const error = new Error('Generation cancelled')
  error.name = 'AbortError'
  return error
}

function wait(seconds: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort)
      resolve()
    }, seconds * 1000)
    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }
    abortSignal?.addEventListener('abort', onAbort)
  })
}

function retryDelay(response: Response): number {
  const header = Number(response.headers?.get?.('Retry-After'))
  const seconds = Number.isFinite(header) && header > 0 ? header : DEFAULT_RETRY_SECONDS
  return Math.min(seconds, MAX_RETRY_SECONDS)
}

function readUsage(data: unknown): Usage | undefined {
  const usage = (data as { usage?: Usage } | null)?.usage
  if (!usage || (usage.plan !== 'free' && usage.plan !== 'pro') || typeof usage.used !== 'number' || typeof usage.limit !== 'number') return undefined
  return usage
}

async function requestDescription(prompt: string, imageBase64: string | undefined, paymentToken: string, abortSignal?: AbortSignal): Promise<GenerationResult> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(GENERATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageBase64 ? { prompt, imageBase64, paymentToken } : { prompt, paymentToken }),
      signal: abortSignal
    })

    // The service rate-limits per address and returns Retry-After; batches pace themselves on it.
    if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
      await wait(retryDelay(response), abortSignal)
      continue
    }

    if (!response.ok) {
      const data = await response.json().catch(() => undefined)
      const message = typeof data?.error === 'string' ? data.error : undefined
      if (response.status === 401) throw new TokenError()
      if (response.status === 402) {
        const usage = readUsage(data)
        if (usage) throw new QuotaExceededError(usage, message || 'You have reached your description limit.')
      }
      if (response.status === 429) throw new Error(message || 'Too many requests. Wait a moment and try again.')
      throw new Error(message || `Generation failed (${response.status}). Try again shortly.`)
    }

    const data = await response.json()
    const text = data?.description
    if (typeof text !== 'string' || !text.trim()) throw new Error('No description was returned. Try again.')
    const usage = readUsage(data) || { plan: 'free', used: 0, limit: 1_000, period: null, resetsAt: null }
    return { description: text.trim(), usage }
  }
}

export async function generateDescriptionWithUsage(input: GenerationInput): Promise<GenerationResult> {
  const prompt = buildPrompt(
    input.componentName,
    input.componentType,
    input.properties,
    input.parentName,
    input.customPrompt,
    input.customVariantPrompt,
    input.iconOptions,
    input.variantContext
  )
  return requestDescription(prompt, input.imageBase64, input.paymentToken, input.abortSignal)
}

// Keep the original string-returning helper for callers that only need the description.
export async function generateDescription(input: GenerationInput): Promise<string> {
  return (await generateDescriptionWithUsage(input)).description
}

function usageEndpoint(): string {
  const url = new URL(GENERATION_ENDPOINT)
  url.pathname = '/usage'
  url.search = ''
  return url.toString()
}

export async function fetchUsage(paymentToken: string, abortSignal?: AbortSignal): Promise<Usage> {
  const response = await fetch(usageEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentToken }),
    signal: abortSignal
  })
  const data = await response.json().catch(() => undefined)
  if (response.status === 401) throw new TokenError()
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Usage unavailable (${response.status}).`
    throw new Error(message)
  }
  const usage = readUsage(data)
  if (!usage) throw new Error('The usage response was incomplete. Try again.')
  return usage
}
