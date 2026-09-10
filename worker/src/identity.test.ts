import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveIdentity } from './identity'
import { FakeD1 } from './testing/fakeD1'

afterEach(() => vi.unstubAllGlobals())

describe('payment identity', () => {
  const now = Date.parse('2026-09-09T12:00:00.000Z')

  it('maps paid and trial users to Pro and unpaid users to free', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user_id: 'paid', payment_status: { status: 'PAID' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user_id: 'trial', payment_status: { type: 'TRIAL' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user_id: 'free', payment_status: { status: 'UNPAID' } }) })
    vi.stubGlobal('fetch', fetch)
    const env = { DB: new FakeD1(), FIGMA_TOKEN: 'publisher-token' }

    await expect(resolveIdentity('paid-token', env, now)).resolves.toEqual({ userId: 'paid', plan: 'pro' })
    await expect(resolveIdentity('trial-token', env, now)).resolves.toEqual({ userId: 'trial', plan: 'pro' })
    await expect(resolveIdentity('free-token', env, now)).resolves.toEqual({ userId: 'free', plan: 'free' })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[0][1]).toEqual({ headers: { 'X-Figma-Token': 'publisher-token' } })
  })

  it('uses a cached token without calling Figma again', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user_id: 'user', payment_status: { type: 'UNPAID' } }) })
    vi.stubGlobal('fetch', fetch)
    const env = { DB: new FakeD1(), FIGMA_TOKEN: 'publisher-token' }
    await resolveIdentity('same-token', env, now)
    await expect(resolveIdentity('same-token', env, now + 60_000)).resolves.toEqual({ userId: 'user', plan: 'free' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.each([400, 403])('maps Figma %s to invalid_token', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) }))
    await expect(resolveIdentity('bad-token', { DB: new FakeD1(), FIGMA_TOKEN: 'publisher-token' }, now)).resolves.toEqual({ error: 'invalid_token' })
  })

  it('maps Figma failures to figma_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(resolveIdentity('token', { DB: new FakeD1(), FIGMA_TOKEN: 'publisher-token' }, now)).resolves.toEqual({ error: 'figma_unavailable' })
  })

  it('only accepts local fake payments when explicitly enabled', async () => {
    const db = new FakeD1()
    await expect(resolveIdentity('dev:tester:free', { DB: db }, now)).resolves.toEqual({ error: 'figma_unavailable' })
    await expect(resolveIdentity('dev:tester:free', { DB: db, FAKE_PAYMENTS: '1' }, now)).resolves.toEqual({ userId: 'tester', plan: 'free' })
  })
})
