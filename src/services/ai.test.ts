import { describe, it, expect } from 'vitest'
import { buildPrompt, DEFAULT_PROMPT, DEFAULT_VARIANT_PROMPT } from './ai'

describe('buildPrompt', () => {
  describe('component prompts', () => {
    it('generates prompt for component with default template', () => {
      const result = buildPrompt('Button', 'COMPONENT', ['size', 'variant'])

      expect(result).toContain('Component name: Button')
      expect(result).toContain('Type: COMPONENT')
      expect(result).toContain('Properties: size, variant')
    })

    it('uses custom prompt when provided', () => {
      const customPrompt = 'Describe {name} ({type}) with props: {properties}'
      const result = buildPrompt('Card', 'COMPONENT_SET', ['theme'], undefined, customPrompt)

      expect(result).toBe('Describe Card (COMPONENT_SET) with props: theme')
    })

    it('handles empty properties array', () => {
      const result = buildPrompt('Icon', 'COMPONENT', [])

      expect(result).toContain('Properties: None')
    })

    it('handles multiple properties', () => {
      const result = buildPrompt('Input', 'COMPONENT', ['size', 'disabled', 'error', 'placeholder'])

      expect(result).toContain('Properties: size, disabled, error, placeholder')
    })
  })

  describe('variant prompts', () => {
    it('generates prompt for variant with default template', () => {
      const result = buildPrompt('size=large', 'VARIANT', ['size'], 'Button')

      expect(result).toContain('Parent component: Button')
      expect(result).toContain('Variant: size=large')
      expect(result).toContain('Properties: size')
    })

    it('uses custom variant prompt when provided', () => {
      const customVariantPrompt = 'Variant {name} of {parentName}: {properties}'
      const result = buildPrompt(
        'color=red',
        'VARIANT',
        ['color'],
        'Badge',
        undefined,
        customVariantPrompt
      )

      expect(result).toBe('Variant color=red of Badge: color')
    })

    it('handles variant with no properties', () => {
      const result = buildPrompt('default', 'VARIANT', [], 'Card')

      expect(result).toContain('Properties: None')
    })

    it('uses component template when type is not VARIANT', () => {
      const result = buildPrompt('Button', 'COMPONENT', ['size'], 'SomeParent')

      // Should use component template, not variant template
      expect(result).toContain('Component name: Button')
      expect(result).toContain('Type: COMPONENT')
      expect(result).not.toContain('Parent component:')
    })
  })

  describe('placeholder replacement', () => {
    it('replaces all instances of {name}', () => {
      const customPrompt = '{name} is called {name}'
      const result = buildPrompt('TestComponent', 'COMPONENT', [], undefined, customPrompt)

      expect(result).toBe('TestComponent is called TestComponent')
    })

    it('replaces all instances of {parentName} in variant prompts', () => {
      const customVariantPrompt = '{parentName} has variant, parent is {parentName}'
      const result = buildPrompt('small', 'VARIANT', [], 'Parent', undefined, customVariantPrompt)

      expect(result).toBe('Parent has variant, parent is Parent')
    })
  })
})

describe('DEFAULT_PROMPT', () => {
  it('contains required placeholders', () => {
    expect(DEFAULT_PROMPT).toContain('{name}')
    expect(DEFAULT_PROMPT).toContain('{type}')
    expect(DEFAULT_PROMPT).toContain('{properties}')
  })

  it('includes style guidance', () => {
    expect(DEFAULT_PROMPT).toContain('1-2 sentences')
    expect(DEFAULT_PROMPT).toContain('Shopify Polaris')
  })
})

describe('DEFAULT_VARIANT_PROMPT', () => {
  it('contains required placeholders', () => {
    expect(DEFAULT_VARIANT_PROMPT).toContain('{parentName}')
    expect(DEFAULT_VARIANT_PROMPT).toContain('{name}')
    expect(DEFAULT_VARIANT_PROMPT).toContain('{properties}')
  })

  it('includes style guidance', () => {
    expect(DEFAULT_VARIANT_PROMPT).toContain('1 sentence')
  })
})
