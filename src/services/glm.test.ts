import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateDescription, getProviderDisplayName } from './ai'
import { validateApiKey } from './validation'

const generate = (image?: string, signal?: AbortSignal) => generateDescription(
  'openrouter', 'test-key', 'Button', 'COMPONENT', [], undefined,
  undefined, undefined, image, undefined, undefined, signal
)

afterEach(() => vi.unstubAllGlobals())

describe('GLM via OpenRouter', () => {
  it.each([undefined, 'png-data'])('sends the exact model and optional image (%s)', async (image) => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      choices: [{ message: { content: '  Performs an action.  ', reasoning: 'private reasoning' } }]
    }) })
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(await generate(image, signal)).toBe('Performs an action.')
    const [url, request] = fetch.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(request.headers.Authorization).toBe('Bearer test-key')
    expect(request.signal).toBe(signal)
    const body = JSON.parse(request.body)
    expect(body.model).toBe('z-ai/glm-5.3-flash')
    expect(body.reasoning).toEqual({ effort: 'low', exclude: true })
    expect(body.max_tokens).toBe(4096)
    if (image) expect(body.messages[0].content[1].image_url.url).toBe('data:image/png;base64,png-data')
    else expect(body.messages[0].content).toContain('Component name: Button')
    expect(getProviderDisplayName('openrouter')).toBe('OpenRouter')
  })

  it.each([
    [401, 'Invalid OpenRouter API key'], [402, 'credits are exhausted'], [429, 'rate limiting'],
  ])('reports HTTP %s usefully', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(generate()).rejects.toThrow(message as string)
  })

  it.each([
    { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] },
    { choices: [{ message: { content: '', reasoning: 'not a description' } }] },
    { error: { message: 'upstream error' } },
  ])('does not apply incomplete or missing answers', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
    await expect(generate()).rejects.toThrow()
  })

  it('preserves cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')))
    await expect(generate()).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('validates with the authenticated key endpoint, without generating', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    expect(await validateApiKey('openrouter', 'test-key')).toEqual({ valid: true })
    expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/key', expect.objectContaining({
      method: 'GET', headers: { Authorization: 'Bearer test-key' }
    }))
  })

  it('rejects an invalid OpenRouter key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => JSON.stringify({ error: { message: 'Unauthorized' } })
    }))
    expect(await validateApiKey('openrouter', 'bad')).toEqual({ valid: false, error: 'Invalid API key' })
  })
})

it('uses the requested economical models and disables OpenAI reasoning', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    output_text: 'Description', candidates: [{ content: { parts: [{ text: 'Description' }] } }]
  }) })
  vi.stubGlobal('fetch', fetch)
  await generateDescription('chatgpt', 'test', 'Button', 'COMPONENT', [])
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    model: 'gpt-5.4-nano', reasoning: { effort: 'none' }
  })
  await generateDescription('gemini', 'test', 'Button', 'COMPONENT', [])
  expect(fetch.mock.calls[1][0]).toContain('/models/gemini-2.5-flash-lite:generateContent')
})
