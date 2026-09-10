import { ComponentData } from '../types'
import { GenerationBatch } from '../utils/generationBatches'
import { QuotaExceededError, Usage } from './ai'

export interface GenerationError {
  message: string
  usage?: Usage
}

export interface GenerationState {
  pendingIds: Set<string>
  pageId: string | null
  current: number
  total: number
}

export const idleGeneration = (): GenerationState => ({ pendingIds: new Set(), pageId: null, current: 0, total: 0 })

// Settle cancellation even when an underlying host/provider operation cannot stop.
function cancellable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Generation cancelled', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}

export function createGenerationRunner(options: {
  onChange: (state: GenerationState) => void
  onStart: (ids: Set<string>) => void
  onResult: (component: ComponentData, description: string) => void
  onError: (id: string, error: GenerationError) => void
  onQuotaExceeded: (message: string) => void
}) {
  let active: { controller: AbortController; promise: Promise<void> } | null = null

  function run(
    batches: GenerationBatch[],
    generate: (component: ComponentData, signal: AbortSignal) => Promise<string>,
    pageId: string | null = null
  ): Promise<void> {
    // Claim the runner synchronously, including before the first UI repaint.
    if (active) return active.promise
    const pendingIds = new Set<string>()
    const queue = batches.map(batch => ({ members: batch.members.filter(component => {
      if (pendingIds.has(component.id)) return false
      pendingIds.add(component.id)
      return true
    }) })).filter(batch => batch.members.length > 0)
    if (queue.length === 0) return Promise.resolve()

    const controller = new AbortController()
    const { signal } = controller
    const total = pendingIds.size
    let current = 0
    const publish = () => options.onChange({ pendingIds: new Set(pendingIds), pageId, current, total })
    async function worker() {
      while (!signal.aborted) {
        const batch = queue.shift()
        if (!batch) return
        // Members of a set remain sequential; independent batches share three slots.
        for (const component of batch.members) {
          if (signal.aborted) return
          try {
            const description = await cancellable(generate(component, signal), signal)
            if (!signal.aborted) options.onResult(component, description)
          } catch (error) {
            if (signal.aborted) return
            const failure: GenerationError = { message: error instanceof Error ? error.message : 'Generation failed' }
            if (error instanceof QuotaExceededError) {
              failure.usage = error.usage
              controller.abort()
              options.onQuotaExceeded(error.message)
            }
            options.onError(component.id, failure)
          } finally {
            pendingIds.delete(component.id)
            current += 1
            publish()
          }
        }
      }
    }
    const promise = Promise.resolve().then(async () => {
      options.onStart(new Set(pendingIds))
      publish()
      try {
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker))
      } finally {
        active = null
        options.onChange(idleGeneration())
      }
    })
    active = { controller, promise }
    return promise
  }

  return { run, cancel: () => active?.controller.abort() }
}
