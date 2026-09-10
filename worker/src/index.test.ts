import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from './index'
import { GEMINI_MODEL, MAX_IMAGE_CHARS, MAX_PROMPT_CHARS } from './constants'
import { createTestDatabase } from './testing/sqliteD1'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

let env: { GEMINI_API_KEY: string; DB: ReturnType<typeof createTestDatabase>; FAKE_PAYMENTS: string }
beforeEach(() => { env = { GEMINI_API_KEY: 'secret', DB: createTestDatabase(), FAKE_PAYMENTS: '1' } })

function post(body: unknown, headers: Record<string, string> = {}) {
  if (body && typeof body === 'object' && !Array.isArray(body) && !('paymentToken' in body)) {
    body = { ...body as Record<string, unknown>, paymentToken: 'dev:tester:free' }
  }
  return new Request('https://service.test/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

function geminiResponse(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => data }
}

describe('generation service', () => {
  it('reads usage and generates through the real Figma payment response envelope', async () => {
    const liveShapeEnv = { DB: createTestDatabase(), FIGMA_TOKEN: 'publisher-token', GEMINI_API_KEY: 'secret' }
    const fetch = vi.fn()
      .mockResolvedValueOnce(geminiResponse({ status: 200, error: false, meta: {
        user_id: 'envelope-user', resource_id: '1678669904810665842', resource_type: 'PLUGIN',
        payment_status: { status: 'UNPAID' },
      } }))
      .mockResolvedValueOnce(geminiResponse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Displays an action.' }] } }] }))
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const usage = await worker.fetch(new Request('https://service.test/usage', {
      method: 'POST', body: JSON.stringify({ paymentToken: 'figma-session-token' }),
    }), liveShapeEnv)
    expect(usage.status).toBe(200)
    expect(await usage.json()).toMatchObject({ usage: { plan: 'free', used: 0, limit: 1000 } })
    const generated = await worker.fetch(post({ prompt: 'Describe Button', paymentToken: 'figma-session-token' }), liveShapeEnv)
    expect(generated.status).toBe(200)
    expect(await generated.json()).toMatchObject({ description: 'Displays an action.', usage: { used: 1 } })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toContain('api.figma.com/v1/payments?')
    expect(fetch.mock.calls[1][0]).toContain('generativelanguage.googleapis.com/')
  })

  it('answers preflight with permissive CORS for the null plugin origin', async () => {
    const response = await worker.fetch(new Request('https://service.test/generate', { method: 'OPTIONS' }), env)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('rejects unknown paths and methods', async () => {
    expect((await worker.fetch(new Request('https://service.test/other', { method: 'POST' }), env)).status).toBe(404)
    const wrongMethod = await worker.fetch(new Request('https://service.test/generate'), env)
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get('Allow')).toBe('POST, OPTIONS')
  })

  it('requires a payment token and exposes usage without reserving a description', async () => {
    const missing = await worker.fetch(post({ prompt: 'Describe', paymentToken: undefined }), env)
    expect(missing.status).toBe(400)
    expect(await missing.json()).toMatchObject({ code: 'bad_request' })

    const usage = await worker.fetch(new Request('https://service.test/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentToken: 'dev:usage-only:free' })
    }), env)
    expect(usage.status).toBe(200)
    expect(await usage.json()).toEqual({ usage: { plan: 'free', used: 0, limit: 1000, period: null, resetsAt: null } })
  })

  it('validates the body before touching the model', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await worker.fetch(post('not json'), env)).status).toBe(400)
    expect((await worker.fetch(post({ prompt: '  ' }), env)).status).toBe(400)
    expect((await worker.fetch(post({ prompt: 'x'.repeat(MAX_PROMPT_CHARS + 1) }), env)).status).toBe(400)
    expect((await worker.fetch(post({ prompt: 'Describe', imageBase64: 'not base64!' }), env)).status).toBe(400)
    expect((await worker.fetch(post({ prompt: 'Describe', imageBase64: 'A'.repeat(MAX_IMAGE_CHARS + 1) }), env)).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports a missing secret without calling Google', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const response = await worker.fetch(post({ prompt: 'Describe' }), {})
    expect(response.status).toBe(500)
    expect((await response.json()).error).toContain('not configured')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('forwards the prompt and image to Gemini and returns the text', async () => {
    const fetch = vi.fn().mockResolvedValue(geminiResponse({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '  Displays a list of actions.  ' }] } }],
      usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 12, totalTokenCount: 312 }
    }))
    vi.stubGlobal('fetch', fetch)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const response = await worker.fetch(post({ prompt: 'Describe Button', imageBase64: 'aGVsbG8=' }), env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      description: 'Displays a list of actions.',
      usage: { plan: 'free', used: 1, limit: 1000, period: null, resetsAt: null }
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const [url, request] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/models/${GEMINI_MODEL}:generateContent`)
    expect(url).not.toContain('secret')
    expect((request.headers as Record<string, string>)['x-goog-api-key']).toBe('secret')
    const body = JSON.parse(request.body as string)
    expect(body.contents[0].parts).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
      { text: 'Describe Button' }
    ])
    expect(body.generationConfig.maxOutputTokens).toBe(256)
    // Usage logging must never include prompt or description content.
    const logged = log.mock.calls[0][0] as string
    expect(logged).toContain('"totalTokens":312')
    expect(logged).not.toContain('Describe Button')
    expect(logged).not.toContain('Displays')
  })

  it('applies the per-IP rate limit before parsing', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const response = await worker.fetch(post({ prompt: 'Describe' }, { 'cf-connecting-ip': '203.0.113.9' }), { ...env, GENERATE_LIMIT: { limit } })
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.9' })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('10')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps upstream failures to readable plugin errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    fetch.mockResolvedValueOnce(geminiResponse({}, 429))
    const busy = await worker.fetch(post({ prompt: 'Describe' }), env)
    expect(busy.status).toBe(503)
    expect(busy.headers.get('Retry-After')).toBe('10')

    fetch.mockResolvedValueOnce(geminiResponse({ error: { message: 'bad key' } }, 400))
    const failed = await worker.fetch(post({ prompt: 'Describe' }), env)
    expect(failed.status).toBe(502)
    expect((await failed.json()).error).not.toContain('bad key')

    fetch.mockResolvedValueOnce(geminiResponse({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Partial' }] } }] }))
    expect((await (await worker.fetch(post({ prompt: 'Describe' }), env)).json()).error).toContain('response limit')

    fetch.mockResolvedValueOnce(geminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }))
    expect((await worker.fetch(post({ prompt: 'Describe' }), env)).status).toBe(422)

    fetch.mockResolvedValueOnce(geminiResponse({ candidates: [{ content: { parts: [{}] } }] }))
    expect((await (await worker.fetch(post({ prompt: 'Describe' }), env)).json()).error).toContain('No description')
  })

  it('returns quota details and releases a reservation after a Gemini failure', async () => {
    const db = env.DB
    await worker.fetch(new Request('https://service.test/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentToken: 'dev:limited:free' }) }), env)
    await db.prepare('UPDATE users SET free_limit_override = 1 WHERE user_id = ?1').bind('limited').run()
    const fetch = vi.fn()
      .mockResolvedValueOnce(geminiResponse({ error: { message: 'bad key' } }, 400))
      .mockResolvedValueOnce(geminiResponse({ candidates: [{ content: { parts: [{ text: 'Works.' }] } }] }))
    vi.stubGlobal('fetch', fetch)

    const failed = await worker.fetch(post({ prompt: 'Describe', paymentToken: 'dev:limited:free' }), env)
    expect(failed.status).toBe(502)
    expect((await worker.fetch(new Request('https://service.test/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentToken: 'dev:limited:free' }) }), env)).status).toBe(200)

    const success = await worker.fetch(post({ prompt: 'Describe', paymentToken: 'dev:limited:free' }), env)
    expect(success.status).toBe(200)
    const blocked = await worker.fetch(post({ prompt: 'Describe', paymentToken: 'dev:limited:free' }), env)
    expect(blocked.status).toBe(402)
    expect(await blocked.json()).toMatchObject({ code: 'quota_exceeded', usage: { used: 1, limit: 1 } })
  })

  it.each([
    null,
    { candidates: {} },
    { candidates: [null] },
    { candidates: [{ content: { parts: {} } }] },
    { candidates: [{ content: { parts: [null] } }] },
    { candidates: [{ content: { parts: [{ text: 42 }] } }] },
  ])('returns a structured error and releases malformed Gemini responses: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiResponse(body)))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const prepare = vi.spyOn(env.DB, 'prepare')
    const response = await worker.fetch(post({ prompt: 'Describe' }), env)
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'upstream_error' })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await env.DB.prepare('SELECT lifetime_count, period_count FROM users WHERE user_id = ?1').bind('tester').first()).toEqual({ lifetime_count: 0, period_count: 0 })
    expect(prepare.mock.calls.filter(([sql]) => sql.includes('lifetime_count = MAX'))).toHaveLength(1)
  })

  it('rolls back when the usage read fails after generation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiResponse({ candidates: [{ content: { parts: [{ text: 'Done.' }] } }] })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const prepare = env.DB.prepare.bind(env.DB)
    vi.spyOn(env.DB, 'prepare').mockImplementation(sql => {
      if (sql.startsWith('SELECT user_id, plan, lifetime_count')) throw new Error('Database unavailable')
      return prepare(sql)
    })
    const response = await worker.fetch(post({ prompt: 'Describe' }), env)
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: 'service_error' })
    expect(await env.DB.prepare('SELECT lifetime_count, period_count FROM users WHERE user_id = ?1').bind('tester').first()).toEqual({ lifetime_count: 0, period_count: 0 })
  })

  it('logs cleanup failure once without leaking raw database errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const prepare = env.DB.prepare.bind(env.DB)
    const queries = vi.spyOn(env.DB, 'prepare').mockImplementation(sql => {
      if (sql.includes('lifetime_count = MAX')) throw new Error('Sensitive database error')
      return prepare(sql)
    })
    const response = await worker.fetch(post({ prompt: 'Describe' }), env)
    expect(response.status).toBe(502)
    expect(queries.mock.calls.filter(([sql]) => sql.includes('lifetime_count = MAX'))).toHaveLength(1)
    expect(log.mock.calls.filter(([message]) => JSON.parse(message).event === 'reservation_release_failed')).toHaveLength(1)
    expect(JSON.stringify(log.mock.calls)).not.toContain('Sensitive')
  })
})
