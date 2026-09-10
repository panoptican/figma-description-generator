import { describe, expect, it, vi } from 'vitest'

import { createPaymentSession, UsageState } from './paymentSession'
import { GenerationResult, QuotaExceededError, TokenError, Usage } from './ai'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const input = { componentName: 'Button', componentType: 'COMPONENT', properties: [] }
const usage = (plan: 'free' | 'pro', used = 0): Usage => ({ plan, used, limit: plan === 'free' ? 1000 : 10000, period: plan === 'pro' ? '2026-09' : null, resetsAt: null })

function setup() {
  let state: UsageState = { status: 'loading' }
  const tokens: Array<ReturnType<typeof deferred<{ token: string | null; status: 'PAID' | 'UNPAID' | 'NOT_SUPPORTED' }>>> = []
  const reads: Array<ReturnType<typeof deferred<Usage>>> = []
  const getToken = vi.fn(() => { const d = deferred<{ token: string | null; status: 'PAID' | 'UNPAID' | 'NOT_SUPPORTED' }>(); tokens.push(d); return d.promise })
  const readUsage = vi.fn(() => { const d = deferred<Usage>(); reads.push(d); return d.promise })
  const generate = vi.fn().mockResolvedValue({ description: 'Done.', usage: usage('free', 1) })
  let time = 0
  const session = createPaymentSession({ getToken, readUsage, generate, now: () => time, onChange: value => { state = value } })
  return { session, getToken, readUsage, generate, tokens, reads, state: () => state, advance: () => { time += 300_001 } }
}

describe('payment session', () => {
  it('loads usage once per identity and ignores an old response after checkout', async () => {
    const t = setup()
    const initial = t.session.refresh()
    t.tokens[0].resolve({ token: 'free-token', status: 'UNPAID' })
    await flush()
    const checkout = t.session.refresh()
    expect(t.state()).toEqual({ status: 'loading' })
    t.tokens[1].resolve({ token: 'pro-token', status: 'PAID' })
    await flush()
    t.reads[1].resolve(usage('pro'))
    await checkout
    t.reads[0].resolve(usage('free'))
    await initial
    expect(t.state()).toEqual({ status: 'ready', usage: usage('pro') })
    expect(t.readUsage.mock.calls.map(call => call[0])).toEqual(['free-token', 'pro-token'])
    expect(t.getToken.mock.calls[0][0].aborted).toBe(true)
  })

  it('ignores an older token response arriving after the new token', async () => {
    const t = setup()
    const initial = t.session.refresh()
    const checkout = t.session.refresh()
    t.tokens[1].resolve({ token: 'new', status: 'PAID' })
    await flush()
    t.reads[0].resolve(usage('pro'))
    await checkout
    t.tokens[0].resolve({ token: 'old', status: 'UNPAID' })
    await initial
    expect(t.readUsage).toHaveBeenCalledTimes(1)
    expect(t.state()).toEqual({ status: 'ready', usage: usage('pro') })
  })

  it('keeps a pre-generation usage read from replacing the generation count', async () => {
    const t = setup()
    const loaded = t.session.refresh()
    t.tokens[0].resolve({ token: 'token', status: 'UNPAID' })
    await t.session.generate(input)
    t.reads[0].resolve(usage('free', 0))
    await loaded
    expect(t.state()).toEqual({ status: 'ready', usage: usage('free', 1) })
  })

  it('ignores a generation usage result from before checkout', async () => {
    const t = setup()
    const result = deferred<GenerationResult>()
    t.generate.mockReturnValueOnce(result.promise)
    void t.session.refresh()
    t.tokens[0].resolve({ token: 'old', status: 'UNPAID' })
    const generation = t.session.generate(input)
    await flush()
    const checkout = t.session.refresh()
    t.tokens[1].resolve({ token: 'new', status: 'PAID' })
    await flush()
    t.reads[1].resolve(usage('pro'))
    await checkout
    result.resolve({ description: 'Old request finished.', usage: usage('free', 99) })
    expect(await generation).toBe('Old request finished.')
    expect(t.state()).toEqual({ status: 'ready', usage: usage('pro') })
  })

  it('shares token refresh across concurrent 401s and retries each generation once', async () => {
    const t = setup()
    t.generate.mockRejectedValueOnce(new TokenError()).mockRejectedValueOnce(new TokenError())
    const first = t.session.generate(input)
    const second = t.session.generate(input)
    t.tokens[0].resolve({ token: 'expired', status: 'UNPAID' })
    await flush()
    expect(t.getToken).toHaveBeenCalledTimes(2)
    t.tokens[1].resolve({ token: 'fresh', status: 'UNPAID' })
    await expect(Promise.all([first, second])).resolves.toEqual(['Done.', 'Done.'])
    expect(t.generate.mock.calls.map(call => call[0].paymentToken)).toEqual(['expired', 'expired', 'fresh', 'fresh'])
  })

  it('stops after a second invalid token and publishes quota errors without retrying', async () => {
    const t = setup()
    t.generate.mockRejectedValue(new TokenError())
    const failed = expect(t.session.generate(input)).rejects.toBeInstanceOf(TokenError)
    t.tokens[0].resolve({ token: 'one', status: 'UNPAID' })
    await flush()
    t.tokens[1].resolve({ token: 'two', status: 'UNPAID' })
    await failed
    expect(t.generate).toHaveBeenCalledTimes(2)
    t.generate.mockRejectedValue(new QuotaExceededError(usage('free', 1000), 'Limit reached'))
    await expect(t.session.generate(input)).rejects.toBeInstanceOf(QuotaExceededError)
    expect(t.generate).toHaveBeenCalledTimes(3)
    expect(t.state()).toEqual({ status: 'ready', usage: usage('free', 1000) })
  })

  it('refreshes expired tokens and distinguishes unavailable from usage errors', async () => {
    const t = setup()
    const initial = t.session.refresh()
    t.tokens[0].resolve({ token: null, status: 'NOT_SUPPORTED' })
    await initial
    expect(t.state().status).toBe('unavailable')
    t.advance()
    const generation = t.session.generate(input)
    t.tokens[1].resolve({ token: 'token', status: 'UNPAID' })
    await generation
    const refreshed = t.session.refresh()
    t.tokens[2].resolve({ token: 'fresh', status: 'UNPAID' })
    await flush()
    t.reads[1].reject(new Error('Service offline'))
    await refreshed
    expect(t.state()).toEqual({ status: 'error', message: 'Service offline' })
  })

  it('does not publish after disposal', async () => {
    const t = setup()
    const loaded = t.session.refresh()
    t.session.dispose()
    t.tokens[0].resolve({ token: 'late', status: 'UNPAID' })
    await loaded
    expect(t.readUsage).not.toHaveBeenCalled()
    expect(t.state()).toEqual({ status: 'loading' })
    await expect(t.session.generate(input)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
