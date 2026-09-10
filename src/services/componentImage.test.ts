import { afterEach, describe, expect, it, vi } from 'vitest'

import { createComponentImageExporter } from './componentImage'

const { listeners, emit } = vi.hoisted(() => ({ listeners: new Set<(data: unknown) => void>(), emit: vi.fn() }))
vi.mock('@create-figma-plugin/utilities', () => ({
  emit,
  on: (_name: string, listener: (data: unknown) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}))
const reply = (data: unknown) => {
  if (!listeners.size) throw new Error('No host reply listener')
  listeners.forEach(listener => listener(data))
}
afterEach(() => { listeners.clear(); emit.mockClear(); vi.useRealTimers() })

describe('component image requests', () => {
  it('matches overlapping exports by request ID and component ID', async () => {
    const exporter = createComponentImageExporter()
    const first = exporter.export('same', new AbortController().signal)
    const second = exporter.export('same', new AbortController().signal)
    const request1 = emit.mock.calls[0][1]
    const request2 = emit.mock.calls[1][1]
    expect(request1.requestId).not.toBe(request2.requestId)
    reply({ ...request2, imageBase64: 'Second' })
    reply({ ...request1, imageBase64: 'First' })
    expect(await first).toBe('First')
    expect(await second).toBe('Second')
    expect(listeners.size).toBe(1)
    reply({ ...request1, imageBase64: 'Late duplicate' })
    exporter.dispose()
    expect(listeners.size).toBe(0)
  })

  it('removes cancelled requests and ignores their late replies after restart', async () => {
    const exporter = createComponentImageExporter()
    const controller = new AbortController()
    const old = exporter.export('same', controller.signal)
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' })
    const oldRequest = emit.mock.calls[0][1]
    controller.abort()
    await rejected
    expect(listeners.size).toBe(1)
    reply({ ...oldRequest, imageBase64: 'Late while idle' })
    const current = exporter.export('same', new AbortController().signal)
    const currentRequest = emit.mock.calls[1][1]
    reply({ ...oldRequest, imageBase64: 'Old' })
    expect(listeners.size).toBe(1)
    reply({ ...currentRequest, imageBase64: null })
    expect(await current).toBeNull()
    expect(listeners.size).toBe(1)
  })

  it('rejects a mismatched component and cancels pending requests on disposal', async () => {
    const exporter = createComponentImageExporter()
    const wrong = exporter.export('first', new AbortController().signal)
    const mismatch = expect(wrong).rejects.toThrow('different component')
    reply({ ...emit.mock.calls[0][1], id: 'wrong', imageBase64: 'Wrong' })
    await mismatch
    const pending = exporter.export('pending', new AbortController().signal)
    const cancelled = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    exporter.dispose()
    await cancelled
    expect(listeners.size).toBe(0)
    await expect(exporter.export('closed', new AbortController().signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('times out missing requests while retaining a listener for late replies', async () => {
    vi.useFakeTimers()
    const exporter = createComponentImageExporter()
    const request = exporter.export('missing', new AbortController().signal)
    const rejected = expect(request).rejects.toThrow('Figma did not return a component image')
    await vi.advanceTimersByTimeAsync(30_000)
    await rejected
    expect(listeners.size).toBe(1)
    reply({ ...emit.mock.calls[0][1], imageBase64: 'Late' })
    exporter.dispose()
  })
})
