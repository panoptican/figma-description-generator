// Publisher-managed generation service for the Description Generator Figma plugin.

import { resolveIdentity } from './identity'
import { getUsage, release, reserve } from './quota'
import { GEMINI_MODEL, MAX_IMAGE_CHARS, MAX_OUTPUT_TOKENS, MAX_PROMPT_CHARS } from './constants'
import { D1Database, Limits, Plan } from './types'

export interface Env {
  GEMINI_API_KEY?: string
  FIGMA_TOKEN?: string
  DB?: D1Database
  GENERATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> }
  FREE_LIFETIME_LIMIT?: string
  PRO_MONTHLY_LIMIT?: string
  FAKE_PAYMENTS?: string
}

const RETRY_AFTER_SECONDS = 10

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
}

interface GenerateRequest { prompt: string; imageBase64?: string; paymentToken: string }
interface UsageRequest { paymentToken: string }

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS, ...headers }
  })
}

function error(message: string, status: number, code: string, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, code, ...extra }, status, headers)
}

function parseGenerateBody(body: unknown): GenerateRequest | string {
  if (!body || typeof body !== 'object') return 'Send a JSON object with a prompt and paymentToken.'
  const { prompt, imageBase64, paymentToken } = body as Record<string, unknown>
  if (typeof paymentToken !== 'string' || !paymentToken) return 'A Figma payment token is required.'
  if (typeof prompt !== 'string' || !prompt.trim()) return 'The prompt is empty.'
  if (prompt.length > MAX_PROMPT_CHARS) return 'The prompt is too long. Shorten your custom prompt or variant set.'
  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) return 'The image is not valid base64.'
    if (imageBase64.length > MAX_IMAGE_CHARS) return 'The component image is too large to send.'
  }
  return { prompt, imageBase64, paymentToken }
}

function parseUsageBody(body: unknown): UsageRequest | string {
  if (!body || typeof body !== 'object') return 'Send a JSON object with a paymentToken.'
  const { paymentToken } = body as Record<string, unknown>
  return typeof paymentToken === 'string' && paymentToken ? { paymentToken } : 'A Figma payment token is required.'
}

function getLimits(env: Env): Limits {
  return { freeLifetimeLimit: Number(env.FREE_LIFETIME_LIMIT) || 1_000, proMonthlyLimit: Number(env.PRO_MONTHLY_LIMIT) || 10_000 }
}

async function generate(request: GenerateRequest, apiKey: string, identity: { userId: string; plan: Plan }, reservationPeriod: string, db: D1Database, configuredLimits: Limits): Promise<Response> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  if (request.imageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: request.imageBase64 } })
  parts.push({ text: request.prompt })
  const releaseReservation = () => release(db, identity.userId, identity.plan, reservationPeriod).catch(() => {})

  let upstream: Response
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS } })
    })
  } catch {
    await releaseReservation()
    return error('The generation service could not complete the request. Try again shortly.', 502, 'upstream_error')
  }
  if (upstream.status === 429) {
    await releaseReservation()
    return error('The generation service is busy. Try again in a moment.', 503, 'upstream_error', { 'Retry-After': String(RETRY_AFTER_SECONDS) })
  }
  if (!upstream.ok) {
    console.error(JSON.stringify({ event: 'upstream_error', status: upstream.status, userId: identity.userId, plan: identity.plan }))
    await releaseReservation()
    return error('The generation service could not complete the request. Try again shortly.', 502, 'upstream_error')
  }

  let data: {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
    promptFeedback?: { blockReason?: string }
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  }
  try {
    const parsed = await upstream.json()
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid upstream response')
    data = parsed as typeof data
  } catch {
    await releaseReservation()
    return error('The generation service could not complete the request. Try again shortly.', 502, 'upstream_error')
  }
  const candidate = data.candidates?.[0]
  if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
    await releaseReservation()
    return error('The model declined this request. Adjust the prompt or component content and try again.', 422, 'upstream_error')
  }
  if (candidate?.finishReason === 'MAX_TOKENS') {
    await releaseReservation()
    return error('The model reached its response limit. Try a smaller component or variant set.', 502, 'upstream_error')
  }
  const text = candidate?.content?.parts?.map(part => part.text || '').join('').trim()
  if (!text) {
    await releaseReservation()
    return error('No description was returned. Try again.', 502, 'upstream_error')
  }

  const usageMetadata = data.usageMetadata
  console.log(JSON.stringify({ event: 'generate', userId: identity.userId, plan: identity.plan, hasImage: Boolean(request.imageBase64), promptTokens: usageMetadata?.promptTokenCount, outputTokens: usageMetadata?.candidatesTokenCount, totalTokens: usageMetadata?.totalTokenCount }))
  const usage = await getUsage(db, identity.userId, identity.plan, configuredLimits)
  return json({ description: text, usage })
}

async function checkIdentity(token: string, env: Env): Promise<{ identity: { userId: string; plan: Plan } } | { response: Response }> {
  if (!env.DB) return { response: error('The generation service is not configured yet.', 500, 'not_configured') }
  const result = await resolveIdentity(token, env as Env & { DB: D1Database })
  if ('error' in result) {
    if (result.error === 'invalid_token') return { response: error('Your Figma session could not be verified. Reopen the plugin and try again.', 401, 'invalid_token') }
    return { response: error('The generation service could not reach Figma. Try again in a moment.', 503, 'figma_unavailable', { 'Retry-After': String(RETRY_AFTER_SECONDS) }) }
  }
  return { identity: result }
}

async function parseJson(request: Request): Promise<unknown | Response> {
  try { return await request.json() } catch { return error('The request body is not valid JSON.', 400, 'bad_request') }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
    const { pathname } = new URL(request.url)
    if (pathname !== '/generate' && pathname !== '/usage') return error('Not found', 404, 'bad_request')
    if (request.method !== 'POST') return error('Use POST.', 405, 'bad_request', { Allow: 'POST, OPTIONS' })
    if (env.GENERATE_LIMIT) {
      const key = request.headers.get('cf-connecting-ip') || 'unknown'
      const { success } = await env.GENERATE_LIMIT.limit({ key })
      if (!success) return error('Too many requests. Wait a moment and try again.', 429, 'rate_limited', { 'Retry-After': String(RETRY_AFTER_SECONDS) })
    }
    const body = await parseJson(request)
    if (body instanceof Response) return body

    if (pathname === '/usage') {
      const parsed = parseUsageBody(body)
      if (typeof parsed === 'string') return error(parsed, 400, 'bad_request')
      const checked = await checkIdentity(parsed.paymentToken, env)
      if ('response' in checked) return checked.response
      return json({ usage: await getUsage(env.DB!, checked.identity.userId, checked.identity.plan, getLimits(env)) })
    }

    const parsed = parseGenerateBody(body)
    if (typeof parsed === 'string') return error(parsed, 400, 'bad_request')
    if (!env.GEMINI_API_KEY) {
      console.error(JSON.stringify({ event: 'missing_secret' }))
      return error('The generation service is not configured yet.', 500, 'not_configured')
    }
    const checked = await checkIdentity(parsed.paymentToken, env)
    if ('response' in checked) return checked.response
    const configuredLimits = getLimits(env)
    const reservation = await reserve(env.DB!, checked.identity.userId, checked.identity.plan, configuredLimits)
    if (!reservation.ok) {
      const message = checked.identity.plan === 'free'
        ? `You've used all ${reservation.usage.limit.toLocaleString('en-US')} free descriptions. Upgrade to Pro for 10,000 a month.`
        : `You've used this month's ${reservation.usage.limit.toLocaleString('en-US')} descriptions. Your limit resets on ${new Date(reservation.usage.resetsAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}.`
      console.log(JSON.stringify({ event: 'quota_exceeded', userId: checked.identity.userId, plan: checked.identity.plan }))
      return error(message, 402, 'quota_exceeded', {}, { usage: reservation.usage })
    }
    return generate(parsed, env.GEMINI_API_KEY, checked.identity, reservation.usage.period || '', env.DB!, configuredLimits)
  }
}

export type { Limits, Plan, Usage } from './types'
