import { describe, it, expect } from 'vitest'
import {
  filterComponents,
  countMissingDescriptions,
  countGeneratable,
  groupByPage
} from './filters'
import { ComponentData } from '../types'

const createComponent = (overrides: Partial<ComponentData> = {}): ComponentData => ({
  id: 'test-id',
  name: 'TestComponent',
  type: 'COMPONENT',
  properties: [],
  currentDescription: '',
  pageName: 'Page 1',
  ...overrides
})

describe('filterComponents', () => {
  describe('variant filtering', () => {
    it('includes variants when showVariants is true', () => {
      const components = [
        createComponent({ id: '1', type: 'COMPONENT' }),
        createComponent({ id: '2', type: 'VARIANT' }),
        createComponent({ id: '3', type: 'COMPONENT_SET' })
      ]

      const result = filterComponents(components, { showVariants: true, searchValue: '' })

      expect(result).toHaveLength(3)
    })

    it('excludes variants when showVariants is false', () => {
      const components = [
        createComponent({ id: '1', type: 'COMPONENT' }),
        createComponent({ id: '2', type: 'VARIANT' }),
        createComponent({ id: '3', type: 'COMPONENT_SET' })
      ]

      const result = filterComponents(components, { showVariants: false, searchValue: '' })

      expect(result).toHaveLength(2)
      expect(result.every((c) => c.type !== 'VARIANT')).toBe(true)
    })
  })

  describe('search filtering', () => {
    it('matches component name (case insensitive)', () => {
      const components = [
        createComponent({ id: '1', name: 'Button' }),
        createComponent({ id: '2', name: 'Card' }),
        createComponent({ id: '3', name: 'ButtonGroup' })
      ]

      const result = filterComponents(components, { showVariants: true, searchValue: 'button' })

      expect(result).toHaveLength(2)
      expect(result.map((c) => c.name)).toEqual(['Button', 'ButtonGroup'])
    })

    it('matches page name (case insensitive)', () => {
      const components = [
        createComponent({ id: '1', pageName: 'Buttons' }),
        createComponent({ id: '2', pageName: 'Cards' }),
        createComponent({ id: '3', pageName: 'Form Elements' })
      ]

      const result = filterComponents(components, { showVariants: true, searchValue: 'BUTTONS' })

      expect(result).toHaveLength(1)
      expect(result[0].pageName).toBe('Buttons')
    })

    it('matches property values (case insensitive)', () => {
      const components = [
        createComponent({ id: '1', properties: ['size=small', 'variant=primary'] }),
        createComponent({ id: '2', properties: ['size=large'] }),
        createComponent({ id: '3', properties: ['color=red'] })
      ]

      const result = filterComponents(components, { showVariants: true, searchValue: 'primary' })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('returns all components when search is empty', () => {
      const components = [
        createComponent({ id: '1' }),
        createComponent({ id: '2' }),
        createComponent({ id: '3' })
      ]

      const result = filterComponents(components, { showVariants: true, searchValue: '' })

      expect(result).toHaveLength(3)
    })

    it('returns empty array when no matches', () => {
      const components = [
        createComponent({ id: '1', name: 'Button' }),
        createComponent({ id: '2', name: 'Card' })
      ]

      const result = filterComponents(components, { showVariants: true, searchValue: 'xyz123' })

      expect(result).toHaveLength(0)
    })
  })

  describe('combined filtering', () => {
    it('applies both variant and search filters', () => {
      const components = [
        createComponent({ id: '1', type: 'COMPONENT', name: 'Button' }),
        createComponent({ id: '2', type: 'VARIANT', name: 'Button-small' }),
        createComponent({ id: '3', type: 'COMPONENT', name: 'Card' })
      ]

      const result = filterComponents(components, { showVariants: false, searchValue: 'button' })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })
  })
})

describe('countMissingDescriptions', () => {
  it('counts components without descriptions', () => {
    const components = [
      createComponent({ id: '1', currentDescription: '' }),
      createComponent({ id: '2', currentDescription: 'Has description' }),
      createComponent({ id: '3', currentDescription: '' })
    ]

    expect(countMissingDescriptions(components)).toBe(2)
  })

  it('returns 0 when all have descriptions', () => {
    const components = [
      createComponent({ id: '1', currentDescription: 'Desc 1' }),
      createComponent({ id: '2', currentDescription: 'Desc 2' })
    ]

    expect(countMissingDescriptions(components)).toBe(0)
  })

  it('handles empty array', () => {
    expect(countMissingDescriptions([])).toBe(0)
  })

  it('treats whitespace-only descriptions as missing', () => {
    const components = [
      createComponent({ id: '1', currentDescription: '   ' }),
      createComponent({ id: '2', currentDescription: '\n\t' }),
      createComponent({ id: '3', currentDescription: 'Has description' })
    ]

    expect(countMissingDescriptions(components)).toBe(2)
  })
})

describe('countGeneratable', () => {
  it('counts only missing when overwriteExisting is false', () => {
    const components = [
      createComponent({ id: '1', currentDescription: '' }),
      createComponent({ id: '2', currentDescription: 'Has description' }),
      createComponent({ id: '3', currentDescription: '' })
    ]

    expect(countGeneratable(components, false)).toBe(2)
  })

  it('counts all when overwriteExisting is true', () => {
    const components = [
      createComponent({ id: '1', currentDescription: '' }),
      createComponent({ id: '2', currentDescription: 'Has description' }),
      createComponent({ id: '3', currentDescription: '' })
    ]

    expect(countGeneratable(components, true)).toBe(3)
  })

  it('counts whitespace-only descriptions as generatable when overwrite is off', () => {
    const components = [
      createComponent({ id: '1', currentDescription: '   ' }),
      createComponent({ id: '2', currentDescription: 'Has description' })
    ]

    expect(countGeneratable(components, false)).toBe(1)
  })
})

describe('groupByPage', () => {
  it('groups components by page name', () => {
    const components = [
      createComponent({ id: '1', pageName: 'Buttons' }),
      createComponent({ id: '2', pageName: 'Cards' }),
      createComponent({ id: '3', pageName: 'Buttons' })
    ]

    const result = groupByPage(components)

    expect(Object.keys(result)).toEqual(['Buttons', 'Cards'])
    expect(result['Buttons']).toHaveLength(2)
    expect(result['Cards']).toHaveLength(1)
  })

  it('handles empty array', () => {
    expect(groupByPage([])).toEqual({})
  })

  it('preserves component order within pages', () => {
    const components = [
      createComponent({ id: '1', name: 'First', pageName: 'Page' }),
      createComponent({ id: '2', name: 'Second', pageName: 'Page' }),
      createComponent({ id: '3', name: 'Third', pageName: 'Page' })
    ]

    const result = groupByPage(components)

    expect(result['Page'].map((c) => c.name)).toEqual(['First', 'Second', 'Third'])
  })
})
