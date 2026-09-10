import { describe, expect, it, vi } from 'vitest'

import { ComponentData } from '../types'
import { QuotaExceededError, Usage } from './ai'
import { createGenerationRunner, idleGeneration } from './generationRunner'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const component = (id: string): ComponentData => ({ id, name: id, type: 'COMPONENT', properties: [], currentDescription: '', pageId: 'page', pageName: 'Page' })
const batch = (...ids: string[]) => ({ members: ids.map(component) })
function setup() {
  const events = { onChange: vi.fn(), onStart: vi.fn(), onResult: vi.fn(), onError: vi.fn(), onQuotaExceeded: vi.fn() }
  return { runner: createGenerationRunner(events), ...events }
}

describe('shared generation runner', () => {
  it('owns an overlapping row, set, page, and file request before a repaint or image reply', async () => {
    const t = setup()
    const image = deferred<string>()
    const generate = vi.fn(() => image.promise)
    const row = t.runner.run([batch('set')], generate)
    expect(t.runner.run([batch('set', 'variant')], generate)).toBe(row)
    expect(t.runner.run([batch('set', 'variant')], generate, 'page')).toBe(row)
    expect(t.runner.run([batch('set', 'variant'), batch('other')], generate)).toBe(row)
    await flush()
    expect(generate).toHaveBeenCalledOnce()
    expect(t.onChange).toHaveBeenLastCalledWith({ pendingIds: new Set(['set']), pageId: null, current: 0, total: 1 })
    image.resolve('Description')
    await row
    expect(t.onResult).toHaveBeenCalledExactlyOnceWith(component('set'), 'Description')
    expect(t.onChange).toHaveBeenLastCalledWith(idleGeneration())
  })

  it('limits independent batches to three concurrent requests and keeps set members sequential', async () => {
    const t = setup()
    const requests = new Map<string, ReturnType<typeof deferred<string>>>()
    let inFlight = 0
    let peak = 0
    const generate = vi.fn((c: ComponentData) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      const request = deferred<string>()
      requests.set(c.id, request)
      return request.promise.finally(() => { inFlight -= 1 })
    })
    const run = t.runner.run([batch('set', 'v1', 'v2'), batch('a'), batch('b'), batch('c')], generate, 'page')
    await flush()
    expect([...requests.keys()]).toEqual(['set', 'a', 'b'])
    requests.get('set')!.resolve('Set')
    await flush()
    expect(requests.has('v1')).toBe(true)
    expect(requests.has('v2')).toBe(false)
    requests.get('a')!.resolve('A')
    await flush()
    expect(requests.has('c')).toBe(true)
    requests.get('v1')!.resolve('V1')
    await flush()
    requests.get('v2')!.resolve('V2')
    requests.get('b')!.resolve('B')
    requests.get('c')!.resolve('C')
    await run
    expect(peak).toBe(3)
    expect(t.onResult).toHaveBeenCalledTimes(6)
    expect(t.onChange.mock.calls.at(-2)![0]).toEqual({ pendingIds: new Set(), pageId: 'page', current: 6, total: 6 })
  })

  it('deduplicates component IDs across batches', async () => {
    const t = setup()
    const generate = vi.fn().mockResolvedValue('Done')
    await t.runner.run([batch('set', 'variant'), batch('variant')], generate)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(t.onResult).toHaveBeenCalledTimes(2)
  })

  it('cancels a stalled host request, permits another run, and drops the late result', async () => {
    const t = setup()
    const old = deferred<string>()
    let signal!: AbortSignal
    const cancelled = t.runner.run([batch('same', 'queued')], (_c, s) => { signal = s; return old.promise })
    await flush()
    t.runner.cancel()
    await cancelled
    expect(signal.aborted).toBe(true)
    await t.runner.run([batch('same')], async () => 'New description')
    old.resolve('Old description')
    await flush()
    expect(t.onResult).toHaveBeenCalledExactlyOnceWith(component('same'), 'New description')
    expect(t.onError).not.toHaveBeenCalled()
    expect(t.onChange).toHaveBeenLastCalledWith(idleGeneration())
  })

  it('preserves already applied results when remaining requests are cancelled', async () => {
    const t = setup()
    const run = t.runner.run([batch('done', 'pending')], async c => c.id === 'done' ? 'Written' : new Promise(() => {}))
    await flush()
    t.runner.cancel()
    await run
    expect(t.onResult).toHaveBeenCalledExactlyOnceWith(component('done'), 'Written')
  })

  it('stops on quota exhaustion once, exposes row upgrade data, and drops other late results', async () => {
    const t = setup()
    const usage: Usage = { plan: 'free', used: 1000, limit: 1000, period: null, resetsAt: null }
    const late = deferred<string>()
    const generate = vi.fn((c: ComponentData) => c.id === 'quota' ? Promise.reject(new QuotaExceededError(usage, 'Upgrade')) : late.promise)
    await t.runner.run([batch('quota', 'queued'), batch('other')], generate)
    late.resolve('Too late')
    await flush()
    expect(t.onQuotaExceeded).toHaveBeenCalledExactlyOnceWith('Upgrade')
    expect(t.onError).toHaveBeenCalledExactlyOnceWith('quota', { message: 'Upgrade', usage })
    expect(t.onResult).not.toHaveBeenCalled()
    expect(generate.mock.calls.map(([c]) => c.id)).toEqual(['quota', 'other'])
  })

  it('records each ordinary failure once and continues the remaining members', async () => {
    const t = setup()
    const generate = vi.fn(async c => { if (c.id === 'bad') throw new Error('Unavailable'); return 'Good' })
    await t.runner.run([batch('bad', 'good')], generate)
    expect(t.onError).toHaveBeenCalledExactlyOnceWith('bad', { message: 'Unavailable' })
    expect(t.onResult).toHaveBeenCalledExactlyOnceWith(component('good'), 'Good')
    expect(t.onQuotaExceeded).not.toHaveBeenCalled()
  })

  it('does nothing for an empty selection', async () => {
    const t = setup()
    const generate = vi.fn()
    await t.runner.run([], generate)
    expect(generate).not.toHaveBeenCalled()
    expect(t.onStart).not.toHaveBeenCalled()
  })
})
