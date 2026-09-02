import { describe, expect, it } from 'vitest'
import { isIconComponent } from './icon'

describe('isIconComponent', () => {
  it('keeps detecting components whose names start with icon', () => {
    expect(isIconComponent('Icon', 'Components')).toBe(true)
    expect(isIconComponent('Icon Arrow', 'Components')).toBe(true)
  })

  it('detects components on icon pages regardless of component name or casing', () => {
    expect(isIconComponent('Arrow', 'Icons')).toBe(true)
    expect(isIconComponent('Chevron', 'SYSTEM ICON LIBRARY')).toBe(true)
  })

  it('does not treat similar page names as icon pages', () => {
    expect(isIconComponent('Arrow', 'Iconography')).toBe(false)
    expect(isIconComponent('Arrow', 'Components')).toBe(false)
  })
})
