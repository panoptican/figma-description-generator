import { D1Database, Limits, Plan, Usage } from './types'

interface UserRow {
  user_id: string
  plan: Plan
  lifetime_count: number
  period: string
  period_count: number
  free_limit_override: number | null
  pro_limit_override: number | null
}

interface ReserveRow {
  lifetime_count: number
  period_count: number
  free_limit_override: number | null
  pro_limit_override: number | null
}

function currentPeriod(now: number | Date): string {
  const date = new Date(now instanceof Date ? now.getTime() : now > 1_000_000_000_000 ? now : now * 1000)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function nextMonthReset(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  return next.toISOString()
}

function usageFromRow(row: Pick<UserRow, 'lifetime_count' | 'period' | 'period_count' | 'free_limit_override' | 'pro_limit_override'>, plan: Plan, limits: Limits, period: string): Usage {
  if (plan === 'free') {
    return {
      plan,
      used: row.lifetime_count,
      limit: row.free_limit_override ?? limits.freeLifetimeLimit,
      period: null,
      resetsAt: null
    }
  }
  return {
    plan,
    used: row.period === period ? row.period_count : 0,
    limit: row.pro_limit_override ?? limits.proMonthlyLimit,
    period,
    resetsAt: nextMonthReset(period)
  }
}

function updateUsage(row: ReserveRow, plan: Plan, limits: Limits, period: string): Usage {
  return plan === 'free'
    ? { plan, used: row.lifetime_count, limit: row.free_limit_override ?? limits.freeLifetimeLimit, period: null, resetsAt: null }
    : { plan, used: row.period_count, limit: row.pro_limit_override ?? limits.proMonthlyLimit, period, resetsAt: nextMonthReset(period) }
}

export async function reserve(db: D1Database, userId: string, plan: Plan, limits: Limits, now: number | Date = Date.now()): Promise<{ ok: true; usage: Usage } | { ok: false; usage: Usage }> {
  const period = currentPeriod(now)
  const updatedAt = new Date(now instanceof Date ? now.getTime() : now > 1_000_000_000_000 ? now : now * 1000).toISOString()
  const result = await db.prepare(`UPDATE users SET
  period_count = CASE WHEN period = ?1 THEN period_count + 1 ELSE 1 END,
  period = ?1,
  lifetime_count = lifetime_count + 1,
  updated_at = ?2
WHERE user_id = ?3 AND (
  (?4 = 1 AND (CASE WHEN period = ?1 THEN period_count ELSE 0 END) < COALESCE(pro_limit_override, ?6))
  OR
  (?4 = 0 AND lifetime_count < COALESCE(free_limit_override, ?5))
)
RETURNING lifetime_count, period_count, free_limit_override, pro_limit_override;`)
    .bind(period, updatedAt, userId, plan === 'pro' ? 1 : 0, limits.freeLifetimeLimit, limits.proMonthlyLimit)
    .first<ReserveRow>()

  if (result) return { ok: true, usage: updateUsage(result, plan, limits, period) }

  const row = await db.prepare('SELECT user_id, plan, lifetime_count, period, period_count, free_limit_override, pro_limit_override FROM users WHERE user_id = ?1')
    .bind(userId)
    .first<UserRow>()
  if (!row) {
    return {
      ok: false,
      usage: plan === 'free'
        ? { plan, used: 0, limit: limits.freeLifetimeLimit, period: null, resetsAt: null }
        : { plan, used: 0, limit: limits.proMonthlyLimit, period, resetsAt: nextMonthReset(period) }
    }
  }
  return { ok: false, usage: usageFromRow(row, plan, limits, period) }
}

export async function getUsage(db: D1Database, userId: string, plan: Plan, limits: Limits, now: number | Date = Date.now()): Promise<Usage> {
  const period = currentPeriod(now)
  const row = await db.prepare('SELECT user_id, plan, lifetime_count, period, period_count, free_limit_override, pro_limit_override FROM users WHERE user_id = ?1')
    .bind(userId)
    .first<UserRow>()
  if (!row) {
    return plan === 'free'
      ? { plan, used: 0, limit: limits.freeLifetimeLimit, period: null, resetsAt: null }
      : { plan, used: 0, limit: limits.proMonthlyLimit, period, resetsAt: nextMonthReset(period) }
  }
  return usageFromRow(row, plan, limits, period)
}

export async function release(db: D1Database, userId: string, plan: Plan, period: string): Promise<void> {
  await db.prepare(`UPDATE users SET
  lifetime_count = MAX(lifetime_count - 1, 0),
  period_count = CASE WHEN period = ?2 THEN MAX(period_count - 1, 0) ELSE period_count END
WHERE user_id = ?1 AND (?3 = 0 OR period = ?2)`)
    .bind(userId, period, plan === 'pro' ? 1 : 0)
    .run()
}
