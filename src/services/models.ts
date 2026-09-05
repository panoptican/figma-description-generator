import { AIProvider, ModelSelection } from '../types'

export const GEMINI_MODEL = 'gemini-2.5-flash-lite'
export const CLAUDE_MODEL = 'claude-haiku-4-5'
export const OPENAI_MODEL = 'gpt-5.4-nano'
export const GLM_MODEL = 'z-ai/glm-5.3-flash'

export const DEFAULT_MODELS: Record<AIProvider, ModelSelection> = {
  chatgpt: { id: OPENAI_MODEL, name: 'GPT-5.4 nano', supportsImages: true },
  claude: { id: CLAUDE_MODEL, name: 'Claude Haiku 4.5', supportsImages: true },
  gemini: { id: GEMINI_MODEL, name: 'Gemini 2.5 Flash-Lite', supportsImages: true },
  openrouter: { id: GLM_MODEL, name: 'GLM 5.3 Flash', supportsImages: true,
    reasoning: { mandatory: true, supportedEfforts: ['max', 'high', 'low'] } }
}

export function selectedModel(provider: AIProvider, models?: Partial<Record<AIProvider, ModelSelection>>): ModelSelection {
  return models?.[provider]?.id.trim() ? models[provider]! : DEFAULT_MODELS[provider]
}

interface CatalogModel {
  id?: string
  name?: string
  display_name?: string
  displayName?: string
  supportedGenerationMethods?: string[]
  architecture?: { input_modalities?: string[]; output_modalities?: string[] }
  capabilities?: { image_input?: { supported?: boolean } }
  reasoning?: { mandatory?: boolean; supported_efforts?: string[] }
}

export function normalizeModels(provider: AIProvider, models: CatalogModel[]): ModelSelection[] {
  const normalized = models.flatMap((model): ModelSelection[] => {
    const id = provider === 'gemini' ? model.name?.replace(/^models\//, '') : model.id
    if (!id) return []
    if (provider === 'chatgpt' && (!/^(gpt-|o\d)/.test(id) || /embedding|audio|realtime|transcri|tts|image|dall-e|moderation/.test(id))) return []
    if (provider === 'gemini' && (!model.supportedGenerationMethods?.includes('generateContent') || /image|tts|audio|robotics/.test(id))) return []
    if (provider === 'openrouter' && (!model.architecture?.input_modalities?.includes('text') || !model.architecture?.output_modalities?.includes('text'))) return []
    return [{
      id,
      name: model.display_name || model.displayName || (provider === 'openrouter' ? model.name : undefined) || id,
      supportsImages: provider === 'openrouter'
        ? model.architecture?.input_modalities?.includes('image')
        : model.capabilities?.image_input?.supported,
      ...(model.reasoning ? { reasoning: {
        mandatory: model.reasoning.mandatory,
        supportedEfforts: model.reasoning.supported_efforts
      } } : {})
    }]
  })
  return Array.from(new Map(normalized.map(model => [model.id, model])).values())
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadModels(provider: AIProvider, apiKey: string, signal?: AbortSignal): Promise<ModelSelection[]> {
  if (provider !== 'openrouter' && !apiKey.trim()) throw new Error('Enter an API key to load models.')
  const headers: Record<string, string> = provider === 'claude'
    ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    : provider === 'chatgpt' ? { Authorization: `Bearer ${apiKey}` } : {}
  // OpenRouter's catalog is public; don't transmit a key just to browse models.
  let url = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/models'
    : provider === 'claude' ? 'https://api.anthropic.com/v1/models?limit=1000'
    : provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`
    : 'https://api.openai.com/v1/models'
  const baseUrl = url
  const models: CatalogModel[] = []
  const cursors = new Set<string>()
  while (url) {
    const response = await fetch(url, { headers, signal })
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'Could not load models. Check the API key and account access.'
      : 'Could not load models. Try again shortly.')
    const data = await response.json()
    const items = provider === 'gemini' ? data.models : data.data
    if (!Array.isArray(items)) throw new Error('The provider returned an unreadable model list.')
    models.push(...items)
    const cursor = provider === 'gemini' ? data.nextPageToken
      : provider === 'claude' && data.has_more ? data.last_id : undefined
    if (cursor && cursors.has(cursor)) throw new Error('The provider repeated a model page. Try again shortly.')
    if (cursor) cursors.add(cursor)
    url = cursor ? `${baseUrl}&${provider === 'gemini' ? 'pageToken' : 'after_id'}=${encodeURIComponent(cursor)}` : ''
  }
  return normalizeModels(provider, models)
}
