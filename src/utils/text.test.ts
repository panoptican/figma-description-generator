import { describe, it, expect } from 'vitest'
import {
  normalizeDescription,
  isDescriptionEmpty,
  formatProperties,
  parseVariantName
} from './text'

describe('normalizeDescription', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeDescription('  Hello world  ')).toBe('Hello world')
  })

  it('preserves internal whitespace', () => {
    expect(normalizeDescription('Hello   world')).toBe('Hello   world')
  })

  it('handles empty string', () => {
    expect(normalizeDescription('')).toBe('')
  })

  it('handles string with only whitespace', () => {
    expect(normalizeDescription('   ')).toBe('')
  })

  it('handles newlines', () => {
    expect(normalizeDescription('\nHello\n')).toBe('Hello')
  })
})

describe('isDescriptionEmpty', () => {
  it('returns true for undefined', () => {
    expect(isDescriptionEmpty(undefined)).toBe(true)
  })

  it('returns true for null', () => {
    expect(isDescriptionEmpty(null)).toBe(true)
  })

  it('returns true for empty string', () => {
    expect(isDescriptionEmpty('')).toBe(true)
  })

  it('returns true for whitespace-only string', () => {
    expect(isDescriptionEmpty('   ')).toBe(true)
  })

  it('returns false for non-empty string', () => {
    expect(isDescriptionEmpty('Hello')).toBe(false)
  })

  it('returns false for string with content and whitespace', () => {
    expect(isDescriptionEmpty('  Hello  ')).toBe(false)
  })
})

describe('formatProperties', () => {
  it('joins properties with comma and space', () => {
    expect(formatProperties(['size', 'variant', 'disabled'])).toBe('size, variant, disabled')
  })

  it('returns single property without comma', () => {
    expect(formatProperties(['size'])).toBe('size')
  })

  it('returns "None" for empty array', () => {
    expect(formatProperties([])).toBe('None')
  })
})

describe('parseVariantName', () => {
  it('parses single key=value pair', () => {
    expect(parseVariantName('size=large')).toEqual({ size: 'large' })
  })

  it('parses multiple key=value pairs', () => {
    expect(parseVariantName('size=large, variant=primary')).toEqual({
      size: 'large',
      variant: 'primary'
    })
  })

  it('handles whitespace around pairs', () => {
    expect(parseVariantName('  size=large  ,  variant=primary  ')).toEqual({
      size: 'large',
      variant: 'primary'
    })
  })

  it('returns empty object for string without equals', () => {
    expect(parseVariantName('default')).toEqual({})
  })

  it('handles value containing equals sign', () => {
    expect(parseVariantName('formula=a=b')).toEqual({ formula: 'a=b' })
  })

  it('returns empty object for empty string', () => {
    expect(parseVariantName('')).toEqual({})
  })

  it('handles mixed valid and invalid parts', () => {
    expect(parseVariantName('size=large, default, variant=primary')).toEqual({
      size: 'large',
      variant: 'primary'
    })
  })
})
