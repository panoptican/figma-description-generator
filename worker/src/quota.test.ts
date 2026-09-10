import { describe, expect, it } from 'vitest'

import { getUsage, release, reserve } from './quota'
import { createTestDatabase } from './testing/sqliteD1'

const limits = { freeLifetimeLimit: 1_000, proMonthlyLimit: 10_000 }
const now = Date.parse('2026-09-09T12:00:00.000Z')

async function seed(db: ReturnType<typeof createTestDatabase>, userId: string, plan: 'free' | 'pro', values: Partial<{ lifetime_count: number; period: string; period_count: number; free_limit_override: number | null; pro_limit_override: number | null }> = {}) {
  await db.prepare(`INSERT INTO users (user_id, plan, lifetime_count, period, period_count, free_limit_override, pro_limit_override, first_seen_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`)
    .bind(userId, plan, values.lifetime_count ?? 0, values.period ?? '2026-09', values.period_count ?? 0, values.free_limit_override ?? null, values.pro_limit_override ?? null, new Date(now).toISOString())
    .run()
}

describe('quota', () => {
  it('reserves free descriptions until the lifetime cap', async () => {
    const db = createTestDatabase()
    await seed(db, 'free', 'free', { lifetime_count: 999 })
    expect((await reserve(db, 'free', 'free', limits, now)).usage).toMatchObject({ plan: 'free', used: 1_000, limit: 1_000, period: null, resetsAt: null })
    const blocked = await reserve(db, 'free', 'free', limits, now)
    expect(blocked).toEqual({ ok: false, usage: { plan: 'free', used: 1_000, limit: 1_000, period: null, resetsAt: null } })
  })

  it('resets Pro usage when the UTC month changes', async () => {
    const db = createTestDatabase()
    await seed(db, 'pro', 'pro', { period: '2026-08', period_count: 10_000, lifetime_count: 10_000 })
    const result = await reserve(db, 'pro', 'pro', limits, now)
    expect(result).toMatchObject({ ok: true, usage: { plan: 'pro', used: 1, period: '2026-09', limit: 10_000 } })
  })

  it('uses manual overrides and releases a failed reservation', async () => {
    const db = createTestDatabase()
    await seed(db, 'user', 'free', { free_limit_override: 2 })
    const first = await reserve(db, 'user', 'free', limits, now)
    await reserve(db, 'user', 'free', limits, now)
    expect((await reserve(db, 'user', 'free', limits, now)).ok).toBe(false)
    if (!first.ok) throw new Error('Reservation failed')
    await release(db, first.reservation)
    expect(await getUsage(db, 'user', 'free', limits, now)).toMatchObject({ used: 1, limit: 2 })
  })

  it('does not allow concurrent reservations past the limit', async () => {
    const db = createTestDatabase()
    await seed(db, 'small', 'free', { free_limit_override: 3 })
    const results = await Promise.all(Array.from({ length: 10 }, () => reserve(db, 'small', 'free', limits, now)))
    expect(results.filter(result => result.ok)).toHaveLength(3)
    expect((await getUsage(db, 'small', 'free', limits, now)).used).toBe(3)
  })

  it('restores both counters after a free failure before an upgrade', async () => {
    const db = createTestDatabase()
    await seed(db, 'upgrade', 'free')
    const result = await reserve(db, 'upgrade', 'free', limits, now)
    if (!result.ok) throw new Error('Reservation failed')
    expect(result.usage.period).toBeNull()
    await release(db, result.reservation)
    expect((await getUsage(db, 'upgrade', 'free', limits, now)).used).toBe(0)
    expect((await getUsage(db, 'upgrade', 'pro', limits, now)).used).toBe(0)
  })

  it.each(['free', 'pro'] as const)('releases a %s lifetime reservation after the month advances', async (plan) => {
    const db = createTestDatabase()
    await seed(db, 'rollover', plan)
    const september = await reserve(db, 'rollover', plan, limits, Date.parse('2026-09-30T23:59:59Z'))
    const octoberTime = Date.parse('2026-10-01T00:00:01Z')
    await reserve(db, 'rollover', plan, limits, octoberTime)
    if (!september.ok) throw new Error('Reservation failed')
    await release(db, september.reservation)
    expect((await getUsage(db, 'rollover', 'free', limits, octoberTime)).used).toBe(1)
    expect((await getUsage(db, 'rollover', 'pro', limits, octoberTime)).used).toBe(1)
  })

  it('enforces the Pro override through SQL as concurrent requests reach the cap', async () => {
    const db = createTestDatabase()
    await seed(db, 'pro-cap', 'pro', { pro_limit_override: 2 })
    const results = await Promise.all(Array.from({ length: 8 }, () => reserve(db, 'pro-cap', 'pro', limits, now)))
    expect(results.filter(result => result.ok)).toHaveLength(2)
    expect((await getUsage(db, 'pro-cap', 'pro', limits, now)).used).toBe(2)
    expect(() => db.prepare('THIS IS NOT SQL RETURNING')).toThrow()
  })
})
