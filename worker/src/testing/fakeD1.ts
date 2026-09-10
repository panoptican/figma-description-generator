import { D1Database, D1PreparedStatement } from '../types'

interface FakeUser {
  user_id: string
  plan: 'free' | 'pro'
  lifetime_count: number
  period: string
  period_count: number
  free_limit_override: number | null
  pro_limit_override: number | null
  first_seen_at: string
  updated_at: string
}

interface FakeCache {
  token_hash: string
  user_id: string
  plan: 'free' | 'pro'
  expires_at: number
}

export class FakeD1 implements D1Database {
  users = new Map<string, FakeUser>()
  tokenCache = new Map<string, FakeCache>()

  prepare(sql: string): D1PreparedStatement {
    return new FakeStatement(this, sql)
  }
}

export function createFakeD1(): FakeD1 {
  return new FakeD1()
}

class FakeStatement implements D1PreparedStatement {
  private values: unknown[] = []

  constructor(private readonly db: FakeD1, private readonly sql: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values
    return this
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes('FROM token_cache')) {
      const row = this.db.tokenCache.get(String(this.values[0]))
      return (row || null) as T | null
    }
    if (this.sql.includes('RETURNING')) {
      const user = this.db.users.get(String(this.values[2]))
      if (!user) return null
      const plan = Number(this.values[3]) === 1 ? 'pro' : 'free'
      const freeLimit = Number(this.values[4])
      const proLimit = Number(this.values[5])
      const period = String(this.values[0])
      const allowed = plan === 'pro'
        ? (user.period === period ? user.period_count : 0) < (user.pro_limit_override ?? proLimit)
        : user.lifetime_count < (user.free_limit_override ?? freeLimit)
      if (!allowed) return null
      user.period_count = user.period === period ? user.period_count + 1 : 1
      user.period = period
      user.lifetime_count += 1
      user.updated_at = String(this.values[1])
      return {
        lifetime_count: user.lifetime_count,
        period_count: user.period_count,
        free_limit_override: user.free_limit_override,
        pro_limit_override: user.pro_limit_override
      } as T
    }
    if (this.sql.includes('FROM users')) {
      return (this.db.users.get(String(this.values[0])) || null) as T | null
    }
    return null
  }

  async run(): Promise<unknown> {
    if (this.sql.includes('token_cache')) {
      this.db.tokenCache.set(String(this.values[0]), {
        token_hash: String(this.values[0]),
        user_id: String(this.values[1]),
        plan: this.values[2] as 'free' | 'pro',
        expires_at: Number(this.values[3])
      })
      return {}
    }
    if (this.sql.includes('INSERT INTO users')) {
      const userId = String(this.values[0])
      const existing = this.db.users.get(userId)
      if (existing) {
        existing.plan = this.values[1] as 'free' | 'pro'
        existing.updated_at = String(this.values[2])
      } else {
        this.db.users.set(userId, {
          user_id: userId,
          plan: this.values[1] as 'free' | 'pro',
          lifetime_count: 0,
          period: '',
          period_count: 0,
          free_limit_override: null,
          pro_limit_override: null,
          first_seen_at: String(this.values[2]),
          updated_at: String(this.values[2])
        })
      }
      return {}
    }
    if (this.sql.includes('lifetime_count = MAX')) {
      const user = this.db.users.get(String(this.values[0]))
      if (!user) return {}
      const period = String(this.values[1])
      const isPro = Number(this.values[2]) === 1
      if (!isPro || user.period === period) {
        user.lifetime_count = Math.max(user.lifetime_count - 1, 0)
        if (user.period === period) user.period_count = Math.max(user.period_count - 1, 0)
      }
    }
    return {}
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] }
  }
}
