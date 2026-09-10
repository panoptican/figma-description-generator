export type Plan = 'free' | 'pro'

export interface Usage {
  plan: Plan
  used: number
  limit: number
  period: string | null
  resetsAt: string | null
}

export interface Limits {
  freeLifetimeLimit: number
  proMonthlyLimit: number
}

export interface D1Result<T> {
  results: T[]
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<unknown>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement
}
