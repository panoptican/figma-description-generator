import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveIdentity } from './identity'
import { createTestDatabase } from './testing/sqliteD1'

// Figma's GET /v1/payments returns PaymentInformation inside this envelope.
// https://github.com/figma/rest-api-spec/blob/main/openapi/openapi.yaml#L10271
function paymentResponse(userId: string, paymentStatus: { type?: string; status?: string }) {
  return { status: 200, error: false, meta: {
    user_id: userId, resource_id: '1678669904810665842', resource_type: 'PLUGIN', payment_status: paymentStatus,
  } }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('payment identity', () => {
  const now = Date.parse('2026-09-09T12:00:00.000Z')

  it('maps paid and trial users to Pro and unpaid users to free', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => paymentResponse('paid', { status: 'PAID' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => paymentResponse('trial', { type: 'TRIAL' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => paymentResponse('free', { status: 'UNPAID' }) })
    vi.stubGlobal('fetch', fetch)
    const env = { DB: createTestDatabase(), FIGMA_TOKEN: 'publisher-token' }

    await expect(resolveIdentity('paid-token', env, now)).resolves.toEqual({ userId: 'paid', plan: 'pro' })
    await expect(resolveIdentity('trial-token', env, now)).resolves.toEqual({ userId: 'trial', plan: 'pro' })
    await expect(resolveIdentity('free-token', env, now)).resolves.toEqual({ userId: 'free', plan: 'free' })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[0][1]).toEqual({ headers: { 'X-Figma-Token': 'publisher-token' } })
  })

  it('uses a cached token without calling Figma again', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => paymentResponse('user', { type: 'UNPAID' }) })
    vi.stubGlobal('fetch', fetch)
    const env = { DB: createTestDatabase(), FIGMA_TOKEN: 'publisher-token' }
    await resolveIdentity('same-token', env, now)
    await expect(resolveIdentity('same-token', env, now + 60_000)).resolves.toEqual({ userId: 'user', plan: 'free' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.each([400, 403])('maps Figma %s to invalid_token', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) }))
    await expect(resolveIdentity('bad-token', { DB: createTestDatabase(), FIGMA_TOKEN: 'publisher-token' }, now)).resolves.toEqual({ error: 'invalid_token' })
  })

  it('maps Figma failures to figma_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(resolveIdentity('token', { DB: createTestDatabase(), FIGMA_TOKEN: 'publisher-token' }, now)).resolves.toEqual({ error: 'figma_unavailable' })
  })

  it('only accepts local fake payments when explicitly enabled', async () => {
    const db = createTestDatabase()
    await expect(resolveIdentity('dev:tester:free', { DB: db }, now)).resolves.toEqual({ error: 'figma_unavailable' })
    await expect(resolveIdentity('dev:tester:free', { DB: db, FAKE_PAYMENTS: '1' }, now)).resolves.toEqual({ userId: 'tester', plan: 'free' })
  })

  it.each([
    null,
    {},
    { user_id: 'user', payment_status: { status: 'PAID' } },
    { ...paymentResponse('user', { status: 'PAID' }), error: true },
    { ...paymentResponse('user', { status: 'PAID' }), status: 500 },
    paymentResponse('', { status: 'PAID' }),
    paymentResponse('user', { status: 'UNKNOWN' }),
  ])('rejects malformed or unsuccessful envelopes without caching an identity: %j', async (body) => {
    const db = createTestDatabase()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(resolveIdentity('private-payment-token', { DB: db, FIGMA_TOKEN: 'private-publisher-token' }, now)).resolves.toEqual({ error: 'figma_unavailable' })
    expect(await db.prepare('SELECT COUNT(*) AS count FROM token_cache').first()).toEqual({ count: 0 })
    expect(await db.prepare('SELECT COUNT(*) AS count FROM users').first()).toEqual({ count: 0 })
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-')
  })
})
