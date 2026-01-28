import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getModifierKeyLabel, getShortcutLabel } from './useKeyboardShortcuts'

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

// Note: Testing the useKeyboardShortcuts hook would require a DOM environment
// and Preact testing utilities. The core functionality is tested via the
// helper functions above, and integration testing would be done manually
// in the Figma plugin environment.
