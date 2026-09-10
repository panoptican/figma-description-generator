import { afterEach, describe, expect, it, vi } from 'vitest'

import { ComponentRow } from './ComponentRow'

// Exercise each row's event handler without mounting a browser UI or calling a provider.
vi.mock('@create-figma-plugin/ui', () => ({ Button: 'button' }))
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
}))

type RowProps = Parameters<typeof ComponentRow>[0]

function makeRow(overrides: Partial<RowProps> = {}) {
  const props: RowProps = {
    component: {
      id: 'variant-a', name: 'Size=Small', type: 'VARIANT', properties: ['Size=Small'],
      currentDescription: 'Original', previousDescription: 'Earlier',
      pageId: 'page', pageName: 'Buttons', parentId: 'set', parentName: 'Button',
    },
    showVariants: true,
    isExpanded: true,
    isGenerating: false,
    isIcon: false,
    wasGeneratedThisSession: false,
    onGenerate: vi.fn().mockResolvedValue('New description'),
    onGenerateComponentSet: vi.fn(),
    onGenerated: vi.fn(),
    onConfirm: vi.fn(),
    onReject: vi.fn(),
    onRevert: vi.fn(),
    onSelect: vi.fn(),
    onToggleExpand: vi.fn(),
    onDisableIcon: vi.fn(),
    onUpgrade: vi.fn(),
    errorResetVersion: 0,
    ...overrides,
  }
  const row = ComponentRow(props)
  return { props, row, press: (event: KeyboardEvent) => row.props.onKeyDown(event) }
}

function findNode(node: any, predicate: (node: any) => boolean): any {
  if (node == null || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  const children = Array.isArray(node) ? node : [node.props?.children]
  for (const child of children) {
    const match = findNode(child, predicate)
    if (match) return match
  }
  return undefined
}

function keyEvent(key: string, options: Record<string, unknown> = {}) {
  const event = {
    key, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false,
    repeat: false, defaultPrevented: false, target: { tagName: 'BUTTON' },
    preventDefault: vi.fn(() => { event.defaultPrevented = true }),
    stopPropagation: vi.fn(),
    ...options,
  }
  return event as unknown as KeyboardEvent
}

afterEach(() => vi.unstubAllGlobals())

describe('focused row shortcuts', () => {
  it.each([true, false])('generates only the focused variant, expanded=%s', async (isExpanded) => {
    const { props, press } = makeRow({ isExpanded })
    const otherRow = makeRow()
    const event = keyEvent('g')
    press(event)
    await Promise.resolve()

    expect(props.onGenerate).toHaveBeenCalledExactlyOnceWith(props.component)
    expect(props.onGenerateComponentSet).not.toHaveBeenCalled()
    expect(props.onConfirm).toHaveBeenCalledExactlyOnceWith('variant-a', 'New description')
    expect(otherRow.props.onGenerate).not.toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
  })

  it('allows focused-editor generation while preserving native undo', async () => {
    const { props, press } = makeRow()
    press(keyEvent('g', { target: { tagName: 'TEXTAREA' } }))
    await Promise.resolve()
    expect(props.onGenerate).toHaveBeenCalledOnce()

    for (const target of [{ tagName: 'TEXTAREA' }, { tagName: 'INPUT' }, { tagName: 'DIV', isContentEditable: true }]) {
      const undo = keyEvent('z', { target })
      press(undo)
      expect(undo.preventDefault).not.toHaveBeenCalled()
    }
    expect(props.onRevert).not.toHaveBeenCalled()
  })

  it('reverts only the row whose control has focus', () => {
    const { props, press } = makeRow()
    press(keyEvent('z', { metaKey: false, ctrlKey: true }))
    expect(props.onRevert).toHaveBeenCalledExactlyOnceWith('variant-a')
  })

  it('treats checkboxes as controls rather than text editors', () => {
    const { props, press } = makeRow()
    press(keyEvent('z', { target: { tagName: 'INPUT', type: 'checkbox' } }))
    expect(props.onRevert).toHaveBeenCalledExactlyOnceWith('variant-a')
  })

  it('leaves whole-file generation and text redo shortcuts to their owners', () => {
    const { props, press } = makeRow()
    for (const key of ['g', 'z']) {
      const event = keyEvent(key, { shiftKey: true })
      press(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
    }
    expect(props.onGenerate).not.toHaveBeenCalled()
    expect(props.onRevert).not.toHaveBeenCalled()
  })

  it('does not repeatedly generate when the shortcut is held down', () => {
    const { props, press } = makeRow()
    press(keyEvent('g', { repeat: true }))
    expect(props.onGenerate).not.toHaveBeenCalled()
  })

  it.each([{ isHidden: true }, { isModalOpen: true }, { isGenerating: true }])(
    'does not generate when the row cannot run: %j', (state) => {
      const { props, press } = makeRow(state)
      press(keyEvent('g'))
      expect(props.onGenerate).not.toHaveBeenCalled()
    }
  )

  it('respects a shortcut already handled by a nested control', () => {
    const { props, press } = makeRow()
    press(keyEvent('g', { defaultPrevented: true }))
    expect(props.onGenerate).not.toHaveBeenCalled()
  })

  it('collapses only the focused row with Escape', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1))
    const { props, press } = makeRow()
    const otherRow = makeRow()
    const event = keyEvent('Escape', { metaKey: false })
    press(event)
    expect(props.onToggleExpand).toHaveBeenCalledExactlyOnceWith('variant-a')
    expect(otherRow.props.onToggleExpand).not.toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
  })
})

describe('direct row controls', () => {
  it.each([true, false])('turns off icon mode without selecting or expanding the row, expanded=%s', (isExpanded) => {
    const { props, row } = makeRow({ isExpanded, isIcon: true })
    const button = findNode(row, (node) => node.props?.['aria-label'] === 'Turn off icon mode for Size=Small')
    const focus = vi.fn()
    row.ref({ querySelector: () => ({ focus }) })
    const click = { stopPropagation: vi.fn() }
    button.props.onClick(click)
    expect(props.onDisableIcon).toHaveBeenCalledExactlyOnceWith('variant-a')
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onToggleExpand).not.toHaveBeenCalled()
    expect(click.stopPropagation).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  })

  it.each([true, false])('has no icon action when icon mode is off, expanded=%s', (isExpanded) => {
    const { row } = makeRow({ isExpanded, isIcon: false })
    expect(findNode(row, (node) => node.props?.['aria-label'] === 'Turn off icon mode for Size=Small')).toBeUndefined()
    expect(findNode(row, (node) => node.type === 'input' && node.props.type === 'checkbox')).toBeUndefined()
  })
})

describe('joined generation actions', () => {
  function makeSetRow(overrides: Partial<RowProps> = {}) {
    return makeRow({
      component: {
        id: 'set', name: 'Button', type: 'COMPONENT_SET', properties: ['Size: Small, Large'],
        currentDescription: 'An existing set description', pageId: 'page', pageName: 'Buttons',
        variantContext: [{ name: 'Size=Small', properties: ['Size=Small'] }],
      },
      ...overrides,
    })
  }

  function action(row: any, label: string) {
    return findNode(row, (node) => node.type === 'button' && node.props.children === label)
  }

  it('runs only the set description from Generate one', async () => {
    const { props, row } = makeSetRow()
    const click = { stopPropagation: vi.fn() }
    action(row, 'Generate one').props.onClick(click)
    await Promise.resolve()

    expect(props.onGenerate).toHaveBeenCalledExactlyOnceWith(props.component)
    expect(props.onConfirm).toHaveBeenCalledExactlyOnceWith('set', 'New description')
    expect(props.onGenerateComponentSet).not.toHaveBeenCalled()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onToggleExpand).not.toHaveBeenCalled()
    expect(click.stopPropagation).toHaveBeenCalledOnce()
  })

  it('runs the existing group action from Set + variants', async () => {
    const { props, row } = makeSetRow()
    const click = { stopPropagation: vi.fn() }
    action(row, 'Set + variants').props.onClick(click)
    await Promise.resolve()

    expect(props.onGenerateComponentSet).toHaveBeenCalledExactlyOnceWith(props.component)
    expect(props.onGenerate).not.toHaveBeenCalled()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onToggleExpand).not.toHaveBeenCalled()
    expect(click.stopPropagation).toHaveBeenCalledOnce()
  })

  it('disables both actions while a batch is running', () => {
    const { row } = makeSetRow({ isGenerating: true })
    expect(action(row, 'Generate one').props.disabled).toBe(true)
    expect(action(row, 'Set + variants').props.disabled).toBe(true)
  })

  it('offers only single generation when variants are hidden', () => {
    const { row } = makeSetRow({ showVariants: false })
    expect(action(row, 'Generate description')).toBeDefined()
    expect(action(row, 'Generate one')).toBeUndefined()
    expect(action(row, 'Set + variants')).toBeUndefined()
  })

  it('offers only single generation for sets without variants', () => {
    const component = { ...makeSetRow().props.component, variantContext: [] }
    const { row } = makeSetRow({ component })
    expect(action(row, 'Generate description')).toBeDefined()
    expect(action(row, 'Set + variants')).toBeUndefined()
  })

  it('keeps standalone components on the single action', () => {
    const component = { ...makeSetRow().props.component, type: 'COMPONENT' as const }
    const { row } = makeRow({ component })
    expect(action(row, 'Generate description')).toBeDefined()
    expect(action(row, 'Set + variants')).toBeUndefined()
  })
})
