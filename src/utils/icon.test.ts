import { describe, expect, it } from 'vitest'
import { isIconComponent, isIconModeEnabled } from './icon'

describe('isIconComponent', () => {
  it('keeps detecting components whose names start with icon', () => {
    expect(isIconComponent('Icon', 'Components')).toBe(true)
    expect(isIconComponent('Icon Arrow', 'Components')).toBe(true)
  })

  it('detects components on icon pages regardless of component name or casing', () => {
    expect(isIconComponent('Arrow', 'Icons')).toBe(true)
    expect(isIconComponent('Chevron', 'SYSTEM ICON LIBRARY')).toBe(true)
  })

  it('recognizes the icon word anywhere in a component name', () => {
    expect(isIconComponent('Arrow Icon', 'Components')).toBe(true)
    expect(isIconComponent('System / Icons / Arrow', 'Components')).toBe(true)
    expect(isIconComponent('ICON / Chevron', 'Components')).toBe(true)
  })

  it('does not treat similar page names as icon pages', () => {
    expect(isIconComponent('Arrow', 'Iconography')).toBe(false)
    expect(isIconComponent('Arrow', 'Components')).toBe(false)
    expect(isIconComponent('Iconography', 'Components')).toBe(false)
    expect(isIconComponent('Silicon chip', 'Components')).toBe(false)
  })
})

describe('isIconModeEnabled', () => {
  it('enables detected icons unless they were manually turned off', () => {
    expect(isIconModeEnabled(true, undefined)).toBe(true)
    expect(isIconModeEnabled(true, false)).toBe(false)
    expect(isIconModeEnabled(true, true)).toBe(true)
  })

  it('ignores legacy manual-on settings for names that are not icons', () => {
    expect(isIconModeEnabled(false, true)).toBe(false)
    expect(isIconModeEnabled(undefined, true)).toBe(false)
    expect(isIconModeEnabled(false, undefined)).toBe(false)
    expect(isIconModeEnabled(false, false)).toBe(false)
  })
})
