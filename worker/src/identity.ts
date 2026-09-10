import { D1Database, Plan } from './types'

export interface IdentityEnv {
  DB: D1Database
  FIGMA_TOKEN?: string
  FAKE_PAYMENTS?: string
}

export type IdentityResult =
  | { userId: string; plan: Plan }
  | { error: 'invalid_token' | 'figma_unavailable' }

interface CachedIdentity {
  user_id: string
  plan: Plan
  expires_at: number
}

interface PaymentResponse {
  status?: number
  error?: boolean
  meta?: {
    user_id?: string
    payment_status?: { type?: string; status?: string }
  }
}

function nowSeconds(now: number | Date): number {
  const value = now instanceof Date ? now.getTime() : now
  return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
}

function isoNow(now: number | Date): string {
  return new Date(now instanceof Date ? now.getTime() : now > 1_000_000_000_000 ? now : now * 1000).toISOString()
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function upsertUser(env: IdentityEnv, userId: string, plan: Plan, now: number | Date) {
  const timestamp = isoNow(now)
  await env.DB.prepare('INSERT INTO users (user_id, plan, first_seen_at, updated_at) VALUES (?1, ?2, ?3, ?3) ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at')
    .bind(userId, plan, timestamp)
    .run()
}

async function saveIdentity(env: IdentityEnv, userId: string, plan: Plan, tokenHash: string, now: number | Date) {
  await env.DB.prepare('INSERT INTO token_cache (token_hash, user_id, plan, expires_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(token_hash) DO UPDATE SET user_id = excluded.user_id, plan = excluded.plan, expires_at = excluded.expires_at')
    .bind(tokenHash, userId, plan, nowSeconds(now) + 600)
    .run()
  await upsertUser(env, userId, plan, now)
}

function fakeIdentity(token: string, env: IdentityEnv): { userId: string; plan: Plan } | null {
  if (!env.FAKE_PAYMENTS) return null
  const match = /^dev:([^:]+):(free|pro)$/.exec(token)
  if (!match) return null
  return { userId: match[1], plan: match[2] as Plan }
}

export async function resolveIdentity(token: string, env: IdentityEnv, now: number | Date = Date.now()): Promise<IdentityResult> {
  const fake = fakeIdentity(token, env)
  if (fake) {
    await saveIdentity(env, fake.userId, fake.plan, await hashToken(token), now)
    return fake
  }

  if (!token) return { error: 'invalid_token' }
  const tokenHash = await hashToken(token)
  const cached = await env.DB.prepare('SELECT user_id, plan, expires_at FROM token_cache WHERE token_hash = ?1')
    .bind(tokenHash)
    .first<CachedIdentity>()
  if (cached && cached.expires_at > nowSeconds(now)) {
    await upsertUser(env, cached.user_id, cached.plan, now)
    return { userId: cached.user_id, plan: cached.plan }
  }

  if (!env.FIGMA_TOKEN) return { error: 'figma_unavailable' }
  let response: Response
  try {
    response = await fetch(`https://api.figma.com/v1/payments?plugin_payment_token=${encodeURIComponent(token)}`, {
      headers: { 'X-Figma-Token': env.FIGMA_TOKEN }
    })
  } catch {
    return { error: 'figma_unavailable' }
  }

  if (response.status >= 400 && response.status < 500) return { error: 'invalid_token' }
  if (response.status >= 500 || !response.ok) return { error: 'figma_unavailable' }

  let body: PaymentResponse | null
  try {
    body = await response.json() as PaymentResponse | null
  } catch {
    return { error: 'figma_unavailable' }
  }
  // The REST API wraps PaymentInformation in meta, unlike the plugin Payments API.
  const payment = body?.meta
  if (body?.error !== false || body.status !== 200 || typeof payment?.user_id !== 'string' || !payment.user_id.trim()) {
    console.error(JSON.stringify({ event: 'figma_identity_error', reason: 'invalid_response' }))
    return { error: 'figma_unavailable' }
  }
  const paymentStatus = payment.payment_status?.type || payment.payment_status?.status
  if (paymentStatus !== 'PAID' && paymentStatus !== 'TRIAL' && paymentStatus !== 'UNPAID') return { error: 'figma_unavailable' }
  const plan: Plan = paymentStatus === 'PAID' || paymentStatus === 'TRIAL' ? 'pro' : 'free'
  await saveIdentity(env, payment.user_id, plan, tokenHash, now)
  return { userId: payment.user_id, plan }
}
