import { describe, expect, it } from 'vitest'

import { getDescriptionStatus } from './descriptionStatus'

describe('getDescriptionStatus', () => {
  it('returns missing for empty descriptions', () => {
    expect(getDescriptionStatus('', false)).toBe('missing')
    expect(getDescriptionStatus('  ', true)).toBe('missing')
  })

  it('returns existing for a description not generated this session', () => {
    expect(getDescriptionStatus('Displays actions.', false)).toBe('existing')
  })

  it('returns generated for a description generated this session', () => {
    expect(getDescriptionStatus('Displays actions.', true)).toBe('generated')
  })

  it('keeps a regenerated description in the generated state', () => {
    expect(getDescriptionStatus('Updated description.', true)).toBe('generated')
  })
})
