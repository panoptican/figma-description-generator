import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getModifierKeyLabel, getShortcutLabel, useKeyboardShortcuts } from './useKeyboardShortcuts'

// Exercise the hook's registered listener without a browser or rendering library.
vi.mock('preact/hooks', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => effect(),
}))

// Mock navigator.platform for testing
const mockNavigator = (platform: string) => {
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true
  })
}

describe('getModifierKeyLabel', () => {
  const originalPlatform = navigator.platform

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  })

  it('returns ⌘ for Mac', () => {
    mockNavigator('MacIntel')
    expect(getModifierKeyLabel()).toBe('⌘')
  })

  it('returns ⌘ for iPhone', () => {
    mockNavigator('iPhone')
    expect(getModifierKeyLabel()).toBe('⌘')
  })

  it('returns ⌘ for iPad', () => {
    mockNavigator('iPad')
    expect(getModifierKeyLabel()).toBe('⌘')
  })

  it('returns Ctrl+ for Windows', () => {
    mockNavigator('Win32')
    expect(getModifierKeyLabel()).toBe('Ctrl+')
  })

  it('returns Ctrl+ for Linux', () => {
    mockNavigator('Linux x86_64')
    expect(getModifierKeyLabel()).toBe('Ctrl+')
  })
})

describe('getShortcutLabel', () => {
  const originalPlatform = navigator.platform

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  })

  describe('on Mac', () => {
    beforeEach(() => {
      mockNavigator('MacIntel')
    })

    it('returns ⌘F for Cmd+F', () => {
      expect(getShortcutLabel('F')).toBe('⌘F')
    })

    it('returns ⌘G for Cmd+G', () => {
      expect(getShortcutLabel('G')).toBe('⌘G')
    })

    it('returns ⌘⇧G for Cmd+Shift+G', () => {
      expect(getShortcutLabel('G', true)).toBe('⌘⇧G')
    })

    it('returns ⌘Z for Cmd+Z', () => {
      expect(getShortcutLabel('Z')).toBe('⌘Z')
    })
  })

  describe('on Windows', () => {
    beforeEach(() => {
      mockNavigator('Win32')
    })

    it('returns Ctrl+F for Ctrl+F', () => {
      expect(getShortcutLabel('F')).toBe('Ctrl+F')
    })

    it('returns Ctrl+G for Ctrl+G', () => {
      expect(getShortcutLabel('G')).toBe('Ctrl+G')
    })

    it('returns Ctrl+⇧G for Ctrl+Shift+G', () => {
      expect(getShortcutLabel('G', true)).toBe('Ctrl+⇧G')
    })

    it('returns Ctrl+Z for Ctrl+Z', () => {
      expect(getShortcutLabel('Z')).toBe('Ctrl+Z')
    })
  })
})

describe('shortcuts with Settings open', () => {
  afterEach(() => vi.unstubAllGlobals())

  function setup(isModalOpen: boolean) {
    let listener: (event: KeyboardEvent) => void
    vi.stubGlobal('window', {
      addEventListener: vi.fn((_name, callback) => { listener = callback }),
      removeEventListener: vi.fn(),
    })
    const handlers = {
      onGenerateSingle: vi.fn(), onGenerateAll: vi.fn(), onFocusSearch: vi.fn(),
      onCloseModal: vi.fn(), onRevert: vi.fn(),
    }
    const input = { focus: vi.fn(), select: vi.fn() }
    useKeyboardShortcuts(handlers, { current: input as unknown as HTMLInputElement }, true, isModalOpen)
    return { handlers, input, press: (key: string, shiftKey = false, tagName = 'BUTTON', metaKey = true) => {
      const event = {
        key, shiftKey, metaKey, ctrlKey: !metaKey,
        target: { tagName }, preventDefault: vi.fn(),
      }
      listener!(event as unknown as KeyboardEvent)
      return event
    } }
  }

  it.each([true, false])('blocks background commands with metaKey=%s', (metaKey) => {
    const { handlers, input, press } = setup(true)
    for (const tag of ['BUTTON', 'INPUT', 'TEXTAREA']) {
      for (const [key, shift] of [['g', false], ['g', true], ['f', false], ['z', false]] as const) {
        press(key, shift, tag, metaKey)
      }
    }
    Object.values(handlers).forEach(handler => expect(handler).not.toHaveBeenCalled())
    expect(input.focus).not.toHaveBeenCalled()
    expect(input.select).not.toHaveBeenCalled()
  })

  it('keeps Escape working and leaves native text undo untouched', () => {
    const { handlers, press } = setup(true)
    expect(press('z', false, 'TEXTAREA').preventDefault).not.toHaveBeenCalled()
    expect(press('Escape').preventDefault).toHaveBeenCalledOnce()
    expect(handlers.onCloseModal).toHaveBeenCalledOnce()
  })

  it('runs commands again when Settings is closed', () => {
    const { handlers, input, press } = setup(false)
    press('g')
    press('g', true)
    press('f')
    press('z')
    expect(handlers.onGenerateSingle).toHaveBeenCalledOnce()
    expect(handlers.onGenerateAll).toHaveBeenCalledOnce()
    expect(handlers.onFocusSearch).toHaveBeenCalledOnce()
    expect(handlers.onRevert).toHaveBeenCalledOnce()
    expect(input.focus).toHaveBeenCalledOnce()
  })
})
