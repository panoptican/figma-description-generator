import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODELS, loadModels, normalizeModels, selectedModel } from './models'
import { generateDescription, openRouterReasoning } from './ai'
import { AIProvider, ModelSelection } from '../types'

afterEach(() => vi.unstubAllGlobals())

describe('model settings and catalogs', () => {
  it('keeps old settings on the defaults and retains separate provider selections', () => {
    expect(selectedModel('openrouter').id).toBe('z-ai/glm-5.3-flash')
    const models = { chatgpt: { id: 'gpt-new', name: 'New' }, gemini: { id: 'gemini-new', name: 'New' } }
    expect(selectedModel('chatgpt', models).id).toBe('gpt-new')
    expect(selectedModel('gemini', models).id).toBe('gemini-new')
    expect(selectedModel('claude', models)).toEqual(DEFAULT_MODELS.claude)
  })

  it('filters non-text OpenRouter models and keeps vision/reasoning metadata', () => {
    expect(normalizeModels('openrouter', [
      { id: 'image-only', architecture: { input_modalities: ['text'], output_modalities: ['image'] } },
      { id: 'new/text', name: 'Text', architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
      { id: 'new/vision', name: 'Vision', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }, reasoning: { mandatory: true, supported_efforts: ['high', 'low'] } }
    ])).toEqual([
      { id: 'new/text', name: 'Text', supportsImages: false },
      { id: 'new/vision', name: 'Vision', supportsImages: true, reasoning: { mandatory: true, supportedEfforts: ['high', 'low'] } }
    ])
  })

  it('filters generation catalogs without hiding new text-model versions', () => {
    expect(normalizeModels('gemini', [
      { name: 'models/gemini-future', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-image', supportedGenerationMethods: ['generateContent'] }
    ]).map(model => model.id)).toEqual(['gemini-future'])
    expect(normalizeModels('chatgpt', [
      { id: 'gpt-future' }, { id: 'gpt-image-1' }, { id: 'gpt-realtime' }, { id: 'text-embedding-3' }, { id: 'o3' }
    ]).map(model => model.id)).toEqual(['gpt-future', 'o3'])
  })

  it('loads the public OpenRouter catalog without transmitting a key', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', fetch)
    await loadModels('openrouter', 'must-not-send')
    expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', expect.objectContaining({ headers: {} }))
  })

  it.each(['gemini', 'claude'] as const)('follows %s catalog pagination', async (provider) => {
    const responses = provider === 'gemini' ? [
      { models: [{ name: 'models/gemini-a', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'next token' },
      { models: [{ name: 'models/gemini-b', supportedGenerationMethods: ['generateContent'] }] }
    ] : [
      { data: [{ id: 'claude-a' }], has_more: true, last_id: 'cursor' },
      { data: [{ id: 'claude-b' }], has_more: false }
    ]
    const fetch = vi.fn().mockImplementation(async () => ({ ok: true, json: async () => responses.shift() }))
    vi.stubGlobal('fetch', fetch)
    const result = await loadModels(provider, 'key')
    expect(result).toHaveLength(2)
    expect(fetch.mock.calls[1][0]).toContain(provider === 'gemini' ? 'pageToken=next%20token' : 'after_id=cursor')
  })

  it('rejects missing keys, malformed responses, and request failures without changing saved choices', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', fetch)
    await expect(loadModels('claude', '')).rejects.toThrow('Enter an API key')
    expect(fetch).not.toHaveBeenCalled()
    await expect(loadModels('claude', 'bad')).rejects.toThrow('Check the API key')
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(loadModels('chatgpt', 'key')).rejects.toThrow('unreadable')
  })

  it('preserves cancellation and stops repeated cursors', async () => {
    const signal = new AbortController().signal
    const fetch = vi.fn().mockRejectedValue(new DOMException('Abort', 'AbortError'))
    vi.stubGlobal('fetch', fetch)
    await expect(loadModels('chatgpt', 'key', signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch.mock.calls[0][1].signal).toBe(signal)
    fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [], has_more: true, last_id: 'same' }) })
    await expect(loadModels('claude', 'key')).rejects.toThrow('repeated')
  })
})

const run = (provider: AIProvider, model: ModelSelection, image?: string) => generateDescription(
  provider, 'key', 'Button', 'COMPONENT', [], undefined, undefined, undefined, image,
  undefined, undefined, undefined, model
)

describe('selected model requests', () => {
  it.each(['chatgpt', 'claude', 'gemini', 'openrouter'] as const)('uses the saved %s model', async provider => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      output_text: 'Description', content: [{ type: 'text', text: 'Description' }],
      candidates: [{ content: { parts: [{ text: 'Description' }] } }],
      choices: [{ message: { content: 'Description' } }]
    }) })
    vi.stubGlobal('fetch', fetch)
    expect(await run(provider, { id: 'future-model', name: 'Future' })).toBe('Description')
    const [url, request] = fetch.mock.calls[0]
    if (provider === 'gemini') expect(url).toContain('/future-model:generateContent')
    else expect(JSON.parse(request.body).model).toBe('future-model')
    if (provider === 'openrouter' || provider === 'chatgpt') expect(JSON.parse(request.body).reasoning).toBeUndefined()
  })

  it('does not send unsupported image requests or expose internal reasoning as descriptions', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      content: [{ type: 'thinking', thinking: 'internal' }, { type: 'text', text: 'Description' }]
    }) })
    vi.stubGlobal('fetch', fetch)
    await expect(run('openrouter', { id: 'text-only', name: 'Text', supportsImages: false }, 'png')).rejects.toThrow('does not accept images')
    expect(fetch).not.toHaveBeenCalled()
    expect(await run('claude', { id: 'claude-new', name: 'Claude' })).toBe('Description')
  })

  it('uses catalog reasoning capabilities instead of forcing GLM parameters on every model', () => {
    expect(openRouterReasoning({ id: 'plain', name: 'Plain' })).toEqual({})
    expect(openRouterReasoning({ id: 'optional', name: 'Optional', reasoning: { mandatory: false } })).toEqual({ reasoning: { enabled: false, exclude: true } })
    expect(openRouterReasoning({ id: 'mandatory', name: 'Mandatory', reasoning: { mandatory: true, supportedEfforts: ['high', 'medium'] } })).toEqual({ reasoning: { effort: 'medium', exclude: true } })
  })

  it.each([
    ['chatgpt', { status: 'incomplete', output_text: 'Partial' }],
    ['claude', { stop_reason: 'max_tokens', content: [{ text: 'Partial' }] }],
    ['gemini', { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial' }] } }] }]
  ] as const)('rejects incomplete %s output', async (provider, data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    await expect(run(provider, { id: 'future-model', name: 'Future' })).rejects.toThrow('response limit')
  })
})
