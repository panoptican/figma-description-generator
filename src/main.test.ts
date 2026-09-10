import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, emit } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  emit: vi.fn(),
}))

vi.mock('@create-figma-plugin/utilities', () => ({
  on: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler),
  emit,
  showUI: vi.fn(),
  loadSettingsAsync: vi.fn(),
  saveSettingsAsync: vi.fn(),
}))

import { allPages, currentPage } from './main'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

function makePage(id: string) {
  let loaded = false
  const page = {
    id,
    name: id,
    type: 'PAGE',
    parent: null,
    selection: [] as unknown[],
    loadAsync: vi.fn(async () => { loaded = true }),
    findAllWithCriteria: vi.fn(() => {
      if (!loaded) throw new Error('Page must be loaded before scanning')
      return [{ id: `${id}:component`, name: 'Button', type: 'COMPONENT', description: '', parent: page }]
    }),
  }
  return page
}

describe('dynamic page access', () => {
  let pageA: ReturnType<typeof makePage>
  let pageB: ReturnType<typeof makePage>
  let api: any
  let pageChanged: () => Promise<void>

  beforeEach(() => {
    handlers.clear()
    emit.mockClear()
    pageA = makePage('A')
    pageB = makePage('B')
    api = {
      currentPage: pageA,
      root: { children: [pageA, pageB] },
      clientStorage: { deleteAsync: vi.fn().mockResolvedValue(undefined) },
      on: vi.fn((_event, handler) => { pageChanged = handler }),
      off: vi.fn(),
      notify: vi.fn(),
      closePlugin: vi.fn(),
      getNodeByIdAsync: vi.fn(),
      setCurrentPageAsync: vi.fn(async (page) => { api.currentPage = page }),
      viewport: { scrollAndZoomIntoView: vi.fn() },
      base64Encode: vi.fn().mockReturnValue('image'),
    }
    vi.stubGlobal('figma', api)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('loads every page before scanning in Entire file mode', async () => {
    allPages()
    await handlers.get('LOAD_COMPONENTS')!()
    expect(pageA.loadAsync).toHaveBeenCalledOnce()
    expect(pageB.loadAsync).toHaveBeenCalledOnce()
    expect(emit.mock.calls[0][1].map((component: any) => component.id)).toEqual(['A:component', 'B:component'])
  })

  it('preserves page identities when two pages have the same name', async () => {
    pageA.name = 'Components'
    pageB.name = 'Components'
    allPages()
    await handlers.get('LOAD_COMPONENTS')!()
    expect(emit.mock.calls[0][1]).toEqual([
      expect.objectContaining({ pageId: 'A', pageName: 'Components' }),
      expect.objectContaining({ pageId: 'B', pageName: 'Components' }),
    ])
  })

  it('only scans the current page and discards a scan overtaken by a page switch', async () => {
    currentPage()
    const pending = deferred()
    const originalLoad = pageA.loadAsync.getMockImplementation()!
    pageA.loadAsync.mockImplementation(async () => { await pending.promise; await originalLoad() })
    const oldScan = handlers.get('LOAD_COMPONENTS')!()
    expect(pageB.loadAsync).not.toHaveBeenCalled()
    api.currentPage = pageB
    await pageChanged()
    pending.resolve()
    await oldScan
    expect(emit).toHaveBeenCalledOnce()
    expect(emit.mock.calls[0][1][0].id).toBe('B:component')
    expect(emit.mock.calls[0][2]).toBe('B')
  })

  it('sends the new page name even when that page has no components', async () => {
    currentPage()
    await handlers.get('LOAD_COMPONENTS')!()
    emit.mockClear()
    pageB.findAllWithCriteria.mockReturnValue([])
    api.currentPage = pageB
    await pageChanged()
    expect(emit).toHaveBeenCalledExactlyOnceWith('COMPONENTS_LOADED', [], 'B')
  })

  it('includes the updated page name when rescanning a renamed page', async () => {
    currentPage()
    pageA.name = 'Renamed page'
    await handlers.get('LOAD_COMPONENTS')!()
    expect(emit).toHaveBeenCalledWith('COMPONENTS_LOADED', [
      expect.objectContaining({ pageName: 'Renamed page' }),
    ], 'Renamed page')
  })

  it('does not follow page navigation in Entire file mode', () => {
    allPages()
    expect(api.on).not.toHaveBeenCalledWith('currentpagechange', expect.any(Function))
  })

  it('ends loading with an actionable notification if a page cannot load', async () => {
    pageB.loadAsync.mockRejectedValue(new Error('Unavailable'))
    allPages()
    await handlers.get('LOAD_COMPONENTS')!()
    expect(emit).toHaveBeenCalledWith('COMPONENTS_LOADED', [], 'A')
    expect(api.notify).toHaveBeenCalledWith(expect.stringContaining('Rescan'), { error: true })
  })

  it('does not publish a scan after the plugin closes', async () => {
    currentPage()
    const scan = handlers.get('LOAD_COMPONENTS')!()
    handlers.get('CLOSE_PLUGIN')!()
    await scan
    expect(emit).not.toHaveBeenCalled()
  })

  it('applies descriptions through asynchronous node lookup', async () => {
    currentPage()
    const node = { type: 'COMPONENT', description: '' }
    api.getNodeByIdAsync.mockResolvedValue(node)
    await handlers.get('APPLY_DESCRIPTION')!({ id: 'component', description: 'Updated' })
    expect(node.description).toBe('Updated')
    expect(emit).toHaveBeenCalledWith('DESCRIPTION_APPLIED', { id: 'component', success: true })
  })

  it('keeps the newest description when an older node lookup finishes last', async () => {
    currentPage()
    const node = { type: 'COMPONENT', description: '' }
    const olderLookup = deferred()
    api.getNodeByIdAsync.mockImplementationOnce(async () => { await olderLookup.promise; return node })
    api.getNodeByIdAsync.mockResolvedValue(node)
    const olderWrite = handlers.get('APPLY_DESCRIPTION')!({ id: 'component', description: 'Older' })
    await handlers.get('APPLY_DESCRIPTION')!({ id: 'component', description: 'Newest' })
    olderLookup.resolve()
    await olderWrite
    expect(node.description).toBe('Newest')
    expect(emit).toHaveBeenCalledOnce()
  })

  it('acknowledges failed description lookup so the UI can report the failure', async () => {
    currentPage()
    api.getNodeByIdAsync.mockRejectedValue(new Error('Unavailable'))
    await handlers.get('APPLY_DESCRIPTION')!({ id: 'missing', description: 'Updated' })
    expect(emit).toHaveBeenCalledWith('DESCRIPTION_APPLIED', { id: 'missing', success: false })
  })

  it('waits for page navigation before selecting and zooming', async () => {
    allPages()
    const node = { type: 'COMPONENT', parent: pageB }
    const navigation = deferred()
    api.getNodeByIdAsync.mockResolvedValue(node)
    api.setCurrentPageAsync.mockImplementation(async () => { await navigation.promise; api.currentPage = pageB })
    const selection = handlers.get('SELECT_COMPONENT')!({ id: 'component' })
    await Promise.resolve()
    expect(pageB.selection).toEqual([])
    expect(api.viewport.scrollAndZoomIntoView).not.toHaveBeenCalled()
    navigation.resolve()
    await selection
    expect(pageB.selection).toEqual([node])
    expect(api.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([node])
  })

  it('reports navigation errors without selecting on the wrong page', async () => {
    allPages()
    api.getNodeByIdAsync.mockResolvedValue({ type: 'COMPONENT', parent: pageB })
    api.setCurrentPageAsync.mockRejectedValue(new Error('Unavailable'))
    await handlers.get('SELECT_COMPONENT')!({ id: 'component' })
    expect(pageA.selection).toEqual([])
    expect(pageB.selection).toEqual([])
    expect(api.notify).toHaveBeenCalled()
  })

  it('exports an image after asynchronous lookup and responds to lookup errors', async () => {
    currentPage()
    const exportAsync = vi.fn().mockResolvedValue(new Uint8Array([1]))
    api.getNodeByIdAsync.mockResolvedValue({ exportAsync })
    await handlers.get('EXPORT_IMAGE')!({ id: 'component' })
    expect(exportAsync).toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith('IMAGE_EXPORTED', { id: 'component', imageBase64: 'image' })
    api.getNodeByIdAsync.mockRejectedValue(new Error('Unavailable'))
    await handlers.get('EXPORT_IMAGE')!({ id: 'missing' })
    expect(emit).toHaveBeenCalledWith('IMAGE_EXPORTED', { id: 'missing', imageBase64: null })
  })

  it('gets the Figma payment token and status in the main thread', async () => {
    api.payments = {
      status: { type: 'UNPAID' },
      getPluginPaymentTokenAsync: vi.fn().mockResolvedValue('payment-token')
    }
    currentPage()
    await handlers.get('GET_PAYMENT_TOKEN')!(7)
    expect(emit).toHaveBeenCalledWith('PAYMENT_TOKEN', { requestId: 7, token: 'payment-token', status: 'UNPAID' })
  })

  it('emits a null payment token when Figma payment lookup throws', async () => {
    api.payments = {
      status: { type: 'NOT_SUPPORTED' },
      getPluginPaymentTokenAsync: vi.fn().mockRejectedValue(new Error('Unavailable'))
    }
    currentPage()
    await handlers.get('GET_PAYMENT_TOKEN')!(7)
    expect(emit).toHaveBeenCalledWith('PAYMENT_TOKEN', { requestId: 7, token: null, status: 'NOT_SUPPORTED' })
  })

  it('always finishes the checkout event when checkout throws', async () => {
    api.payments = {
      status: { type: 'UNPAID' },
      initiateCheckoutAsync: vi.fn().mockRejectedValue(new Error('Dismissed'))
    }
    currentPage()
    await handlers.get('START_CHECKOUT')!()
    expect(emit).toHaveBeenCalledWith('CHECKOUT_FINISHED', { status: 'UNPAID' })
  })

  it('preserves request IDs when payment token lookups finish out of order', async () => {
    let finishOld!: (token: string) => void
    api.payments = {
      status: { type: 'PAID' },
      getPluginPaymentTokenAsync: vi.fn()
        .mockImplementationOnce(() => new Promise<string>(resolve => { finishOld = resolve }))
        .mockResolvedValueOnce('new-token'),
    }
    currentPage()
    const old = handlers.get('GET_PAYMENT_TOKEN')!(1)
    await handlers.get('GET_PAYMENT_TOKEN')!(2)
    finishOld('old-token')
    await old
    expect(emit.mock.calls.filter(call => call[0] === 'PAYMENT_TOKEN')).toEqual([
      ['PAYMENT_TOKEN', { requestId: 2, token: 'new-token', status: 'PAID' }],
      ['PAYMENT_TOKEN', { requestId: 1, token: 'old-token', status: 'PAID' }],
    ])
  })
})

describe('settings migration', () => {
  beforeEach(() => {
    handlers.clear()
    emit.mockClear()
    vi.stubGlobal('figma', { currentPage: { id: 'A', name: 'A' }, root: { children: [] }, clientStorage: { deleteAsync: vi.fn().mockResolvedValue(undefined) }, on: vi.fn(), off: vi.fn(), notify: vi.fn() })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('drops the saved API key and provider fields and rewrites storage without them', async () => {
    const utilities = await import('@create-figma-plugin/utilities')
    const loadSettingsAsync = utilities.loadSettingsAsync as unknown as ReturnType<typeof vi.fn>
    const saveSettingsAsync = utilities.saveSettingsAsync as unknown as ReturnType<typeof vi.fn>
    loadSettingsAsync.mockResolvedValue({
      provider: 'chatgpt', apiKey: 'sk-old', models: { chatgpt: { id: 'x', name: 'x' } },
      customPrompt: 'Mine', customVariantPrompt: '', customIconPrompt: '',
      includeImage: true, showVariants: true, overwriteExisting: false, iconOverrides: { a: false },
    })
    saveSettingsAsync.mockResolvedValue(undefined)
    currentPage()

    await handlers.get('LOAD_SETTINGS')!()

    const expected = { customPrompt: 'Mine', customVariantPrompt: '', customIconPrompt: '', includeImage: true, showVariants: true, overwriteExisting: false, iconOverrides: { a: false } }
    expect(saveSettingsAsync).toHaveBeenCalledWith(expected)
    expect(emit).toHaveBeenCalledWith('SETTINGS_LOADED', expected)
    expect(JSON.stringify(emit.mock.calls)).not.toContain('sk-old')
  })

  it('does not rewrite storage when settings are already in the current shape', async () => {
    const utilities = await import('@create-figma-plugin/utilities')
    const loadSettingsAsync = utilities.loadSettingsAsync as unknown as ReturnType<typeof vi.fn>
    const saveSettingsAsync = utilities.saveSettingsAsync as unknown as ReturnType<typeof vi.fn>
    saveSettingsAsync.mockClear()
    const current = { customPrompt: '', customVariantPrompt: '', customIconPrompt: '', includeImage: false, showVariants: true, overwriteExisting: false, iconOverrides: {} }
    loadSettingsAsync.mockResolvedValue(current)
    currentPage()

    await handlers.get('LOAD_SETTINGS')!()

    expect(saveSettingsAsync).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith('SETTINGS_LOADED', current)
  })
})
