import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildPrompt,
  CLAUDE_MODEL,
  DEFAULT_PROMPT,
  DEFAULT_VARIANT_PROMPT,
  generateDescription,
  GEMINI_MODEL,
  OPENAI_MODEL
} from './ai'

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

describe('generateDescription', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('returns trimmed ChatGPT response text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: '  Generates a clear action label.  ' })
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await generateDescription('chatgpt', 'key', 'Button', 'COMPONENT', ['size'])

    expect(result).toBe('Generates a clear action label.')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(JSON.parse(request.body as string).model).toBe(OPENAI_MODEL)
  })

  it('throws when Gemini returns no text content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{}] } }]
      })
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(
      generateDescription('gemini', 'key', 'Alert', 'COMPONENT', ['tone'])
    ).rejects.toThrow('No response from Gemini')
  })

  it('throws provider-prefixed errors for Claude HTTP failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'rate limit exceeded'
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(
      generateDescription('claude', 'key', 'Badge', 'COMPONENT', ['size'])
    ).rejects.toThrow('Claude API error: rate limit exceeded')
  })

  it('sends image payload to ChatGPT when imageBase64 is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: 'Icon aliases.'
      })
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await generateDescription(
      'chatgpt',
      'key',
      'Arrow',
      'COMPONENT',
      [],
      undefined,
      undefined,
      undefined,
      'abc123'
    )

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedBody = JSON.parse(request.body as string)
    expect(parsedBody.model).toBe(OPENAI_MODEL)
    const messageContent = parsedBody.input[0].content as Array<Record<string, unknown>>

    expect(Array.isArray(messageContent)).toBe(true)
    expect(messageContent[0]?.type).toBe('input_image')
    expect((messageContent[0]?.image_url as string)).toContain('data:image/png;base64,abc123')
  })

  it('uses current model identifiers for Gemini and Claude', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'A description.' }] } }] })
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await generateDescription('gemini', 'key', 'Card', 'COMPONENT', [])
    expect(fetchMock.mock.calls[0][0]).toContain(`/models/${GEMINI_MODEL}:generateContent`)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: 'A description.' }] })
    } as Response)
    await generateDescription('claude', 'key', 'Card', 'COMPONENT', [])
    const claudeBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(claudeBody.model).toBe(CLAUDE_MODEL)
  })
})
