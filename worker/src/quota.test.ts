import { describe, expect, it } from 'vitest'

import { getUsage, release, reserve } from './quota'
import { FakeD1 } from './testing/fakeD1'

const limits = { freeLifetimeLimit: 1_000, proMonthlyLimit: 10_000 }
const now = Date.parse('2026-09-09T12:00:00.000Z')

function seed(db: FakeD1, userId: string, plan: 'free' | 'pro', values: Partial<{ lifetime_count: number; period: string; period_count: number; free_limit_override: number | null; pro_limit_override: number | null }> = {}) {
  db.users.set(userId, {
    user_id: userId,
    plan,
    lifetime_count: values.lifetime_count ?? 0,
    period: values.period ?? '2026-09',
    period_count: values.period_count ?? 0,
    free_limit_override: values.free_limit_override ?? null,
    pro_limit_override: values.pro_limit_override ?? null,
    first_seen_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString()
  })
}

describe('quota', () => {
  it('reserves free descriptions until the lifetime cap', async () => {
    const db = new FakeD1()
    seed(db, 'free', 'free', { lifetime_count: 999 })
    expect((await reserve(db, 'free', 'free', limits, now)).usage).toMatchObject({ plan: 'free', used: 1_000, limit: 1_000, period: null, resetsAt: null })
    const blocked = await reserve(db, 'free', 'free', limits, now)
    expect(blocked).toEqual({ ok: false, usage: { plan: 'free', used: 1_000, limit: 1_000, period: null, resetsAt: null } })
  })

  it('resets Pro usage when the UTC month changes', async () => {
    const db = new FakeD1()
    seed(db, 'pro', 'pro', { period: '2026-08', period_count: 10_000, lifetime_count: 10_000 })
    const result = await reserve(db, 'pro', 'pro', limits, now)
    expect(result).toMatchObject({ ok: true, usage: { plan: 'pro', used: 1, period: '2026-09', limit: 10_000 } })
  })

  it('uses manual overrides and releases a failed reservation', async () => {
    const db = new FakeD1()
    seed(db, 'user', 'free', { free_limit_override: 2 })
    await reserve(db, 'user', 'free', limits, now)
    await reserve(db, 'user', 'free', limits, now)
    expect((await reserve(db, 'user', 'free', limits, now)).ok).toBe(false)
    await release(db, 'user', 'free', '')
    expect(await getUsage(db, 'user', 'free', limits, now)).toMatchObject({ used: 1, limit: 2 })
  })

  it('does not allow sequential concurrent reservations past the limit', async () => {
    const db = new FakeD1()
    seed(db, 'small', 'free', { free_limit_override: 3 })
    const results = await Promise.all(Array.from({ length: 10 }, () => reserve(db, 'small', 'free', limits, now)))
    expect(results.filter(result => result.ok)).toHaveLength(3)
    expect((await getUsage(db, 'small', 'free', limits, now)).used).toBe(3)
  })
})
