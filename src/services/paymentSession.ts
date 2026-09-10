import { PaymentStatus } from '../types'
import { fetchUsage, generateDescriptionWithUsage, GenerationInput, QuotaExceededError, TokenError, Usage } from './ai'

export type UsageState =
  | { status: 'loading' }
  | { status: 'ready'; usage: Usage }
  | { status: 'unavailable' | 'error'; message: string }

interface PaymentIdentity { token: string | null; status: PaymentStatus }
interface SessionOptions {
  getToken: (signal: AbortSignal) => Promise<PaymentIdentity>
  onChange: (state: UsageState) => void
  readUsage?: typeof fetchUsage
  generate?: typeof generateDescriptionWithUsage
  now?: () => number
}

interface IdentitySession {
  controller: AbortController
  token: Promise<string>
  loaded: Promise<void>
  fetchedAt: number
  usageRevision: number
}

export function createPaymentSession({ getToken, onChange, readUsage = fetchUsage, generate = generateDescriptionWithUsage, now = Date.now }: SessionOptions) {
  let current: IdentitySession | null = null
  let disposed = false

  function publish(session: IdentitySession, state: UsageState) {
    if (!disposed && current === session) onChange(state)
  }

  function start(): IdentitySession {
    current?.controller.abort()
    const session: IdentitySession = {
      controller: new AbortController(), token: Promise.resolve(''), loaded: Promise.resolve(), fetchedAt: now(), usageRevision: 0,
    }
    current = session
    publish(session, { status: 'loading' })
    session.token = getToken(session.controller.signal).then(identity => {
      session.fetchedAt = now()
      if (!identity.token) publish(session, { status: 'unavailable', message: 'Figma could not provide a payments token. Reopen the plugin and try again.' })
      return identity.token || ''
    })
    session.loaded = session.token.then(async token => {
      if (!token || current !== session || disposed) return
      const revision = session.usageRevision
      try {
        const usage = await readUsage(token, session.controller.signal)
        if (revision === session.usageRevision) publish(session, { status: 'ready', usage })
      } catch (error) {
        if (revision === session.usageRevision) throw error
      }
    }).catch(error => {
      publish(session, { status: 'error', message: error instanceof Error ? error.message : 'Usage could not be loaded. Try again.' })
    })
    return session
  }

  async function identity(): Promise<{ session: IdentitySession; token: string }> {
    while (!disposed) {
      const session = !current || now() - current.fetchedAt >= 5 * 60 * 1000 ? start() : current
      try {
        const token = await session.token
        if (current === session && !disposed) return { session, token }
      } catch (error) {
        if (current === session) throw error
      }
    }
    throw new DOMException('Plugin closed', 'AbortError')
  }

  function updateUsage(session: IdentitySession, usage: Usage) {
    // A pre-generation usage read must not replace a later generation result.
    session.usageRevision++
    publish(session, { status: 'ready', usage })
  }

  return {
    refresh() {
      return disposed ? Promise.resolve() : start().loaded
    },
    async generate(input: Omit<GenerationInput, 'paymentToken'>): Promise<string> {
      for (let attempt = 0; ; attempt++) {
        if (input.abortSignal?.aborted) throw new DOMException('Generation cancelled', 'AbortError')
        const { session, token } = await identity()
        if (input.abortSignal?.aborted) throw new DOMException('Generation cancelled', 'AbortError')
        try {
          const result = await generate({ ...input, paymentToken: token })
          updateUsage(session, result.usage)
          return result.description
        } catch (error) {
          if (error instanceof TokenError && attempt === 0) {
            // Concurrent 401s share the refresh already started by the first failure.
            if (current === session) start()
            continue
          }
          if (error instanceof QuotaExceededError) updateUsage(session, error.usage)
          throw error
        }
      }
    },
    dispose() {
      disposed = true
      current?.controller.abort()
    },
  }
}
