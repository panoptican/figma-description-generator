import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildPrompt,
  DEFAULT_ICON_PROMPT,
  DEFAULT_PROMPT,
  DEFAULT_VARIANT_PROMPT,
  fetchUsage,
  generateDescription,
  GENERATION_ENDPOINT,
  QuotaExceededError,
  TokenError
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

    it('always includes the parent name when a custom variant prompt omits it', () => {
      const result = buildPrompt(
        'Property 1=Selected',
        'VARIANT',
        ['Property 1=Selected'],
        'Mobile Tab Button',
        undefined,
        'Describe the selected state: {name}'
      )

      expect(result).toContain('Parent component: Mobile Tab Button')
    })

    it('includes the complete variant set context for an individual variant', () => {
      const result = buildPrompt(
        'value=40',
        'VARIANT',
        ['value=40'],
        'Spacing',
        undefined,
        undefined,
        undefined,
        [
          { name: 'value=0', properties: ['value=0'] },
          { name: 'value=4', properties: ['value=4'] },
          { name: 'value=40', properties: ['value=40'] }
        ]
      )

      expect(result).toContain('Complete variant set context (names only):')
      expect(result).toContain('- value=0')
      expect(result).toContain('- value=40')
    })

    it('includes variant set context when describing the component set parent', () => {
      const result = buildPrompt(
        'Spacing',
        'COMPONENT_SET',
        ['value: 0, 4, 8, 16, 24, 32, 40'],
        undefined,
        undefined,
        undefined,
        undefined,
        [
          { name: 'value=0', properties: ['value=0'] },
          { name: 'value=40', properties: ['value=40'] }
        ]
      )

      expect(result).toContain('Complete variant set context (names only):')
      expect(result).toContain('- value=0')
      expect(result).toContain('- value=40')
    })
  })

  describe('icon prompts', () => {
    it('includes the parent component for an icon variant', () => {
      const result = buildPrompt(
        'Property 1=Selected',
        'VARIANT',
        ['Property 1=Selected'],
        'Mobile Tab Button',
        undefined,
        undefined,
        { isIcon: true }
      )

      expect(result).toContain('Icon name: Property 1=Selected')
      expect(result).toContain('Parent component: Mobile Tab Button')
      expect(result).not.toContain('{parentName}')
    })

    it('keeps parent context for a custom icon prompt that omits it', () => {
      const result = buildPrompt(
        'Selected',
        'VARIANT',
        [],
        'Mobile Tab Button',
        undefined,
        undefined,
        { isIcon: true, customIconPrompt: 'Name this icon: {icon_name}' }
      )

      expect(result).toBe('Name this icon: Selected\n\nParent component: Mobile Tab Button')
    })

    it('marks standalone icons as having no parent component', () => {
      const result = buildPrompt('Arrow', 'COMPONENT', [], undefined, undefined, undefined, { isIcon: true })

      expect(result).toContain('Parent component: None')
      expect(DEFAULT_ICON_PROMPT).toContain('{parentName}')
    })

    it('includes sibling names as text context for icon variants', () => {
      const result = buildPrompt(
        'value=40',
        'VARIANT',
        ['value=40'],
        'Spacing icon',
        undefined,
        undefined,
        { isIcon: true },
        [{ name: 'value=40', properties: ['value=40'] }]
      )

      expect(result).toContain('Complete variant set context (names only):')
      expect(result).toContain('- value=40')
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
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function serviceResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
    return {
      ok: status < 400,
      status,
      headers: new Headers(headers),
      json: async () => body
    } as unknown as Response
  }

  it('posts the built prompt to the generation service and returns the trimmed text', async () => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ description: '  Generates a clear action label.  ' }))
    vi.stubGlobal('fetch', fetch)

    const result = await generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: ['size'] })

    expect(result).toBe('Generates a clear action label.')
    expect(fetch).toHaveBeenCalledOnce()
    const [url, request] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(GENERATION_ENDPOINT)
    expect(request.method).toBe('POST')
    const body = JSON.parse(request.body as string)
    expect(body.prompt).toContain('Component name: Button')
    expect(body.prompt).toContain('Properties: size')
    expect(body).not.toHaveProperty('imageBase64')
    expect(JSON.stringify(request.headers)).not.toMatch(/authorization|key/i)
  })

  it('sends the image alongside the prompt when provided', async () => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ description: 'Icon aliases.' }))
    vi.stubGlobal('fetch', fetch)

    await generateDescription({ componentName: 'Arrow', componentType: 'COMPONENT', properties: [], imageBase64: 'abc123', iconOptions: { isIcon: true } })

    const body = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.imageBase64).toBe('abc123')
    expect(body.prompt).toContain('Icon name: Arrow')
  })

  it.each([false, true])('sends one selected image and sibling names as text, icon mode=%s', async (isIcon) => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ description: 'Selected item description.' }))
    vi.stubGlobal('fetch', fetch)
    await generateDescription({
      componentName: 'State=Focused', componentType: 'VARIANT', properties: ['State=Focused'],
      parentName: 'Slider', imageBase64: 'selected-image', paymentToken: 'fixture-token',
      iconOptions: { isIcon, customIconPrompt: 'Name {icon_name}' },
      customVariantPrompt: 'Describe {name}',
      variantContext: [
        { name: 'State=Default', properties: ['redundant parsed property'] },
        { name: 'State=Focused', properties: ['State=Focused'] },
        { name: 'State=Disabled', properties: ['State=Disabled'] },
      ],
    })
    expect(fetch).toHaveBeenCalledOnce()
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.imageBase64).toBe('selected-image')
    expect(Object.keys(body).sort()).toEqual(['imageBase64', 'paymentToken', 'prompt'])
    expect(body.prompt).toContain('Parent component: Slider')
    expect(body.prompt).toContain('- State=Default\n- State=Focused\n- State=Disabled')
    expect(body.prompt).not.toContain('redundant parsed property')
    expect(body.prompt).toContain("Return only the requested item's description")
  })

  it('sends the Figma payment token', async () => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ description: 'A description.' }))
    vi.stubGlobal('fetch', fetch)

    await generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: [], paymentToken: 'figma-token' })

    expect(JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string).paymentToken).toBe('figma-token')
  })

  it('throws a quota error with usage and does not retry', async () => {
    const usage = { plan: 'free', used: 1_000, limit: 1_000, period: null, resetsAt: null }
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ error: 'Upgrade to Pro.', code: 'quota_exceeded', usage }, 402))
    vi.stubGlobal('fetch', fetch)

    const error = await generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: [], paymentToken: 'figma-token' }).catch(error => error)
    expect(error).toBeInstanceOf(QuotaExceededError)
    expect(error.usage).toEqual(usage)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('throws a token error on 401 without retrying', async () => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ error: 'Reopen.' }, 401))
    vi.stubGlobal('fetch', fetch)

    await expect(generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: [], paymentToken: 'figma-token' })).rejects.toBeInstanceOf(TokenError)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('posts payment tokens to the derived usage endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ usage: { plan: 'pro', used: 1_204, limit: 10_000, period: '2026-09', resetsAt: '2026-10-01T00:00:00.000Z' } }))
    vi.stubGlobal('fetch', fetch)

    await expect(fetchUsage('figma-token')).resolves.toMatchObject({ plan: 'pro', used: 1_204 })
    expect(fetch.mock.calls[0][0]).toBe('https://description-generator.spidleweb.workers.dev/usage')
    expect(JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)).toEqual({ paymentToken: 'figma-token' })
  })

  it('forwards an abort signal to the service request', async () => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ description: 'A description.' }))
    vi.stubGlobal('fetch', fetch)
    const abortController = new AbortController()

    await generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: [], abortSignal: abortController.signal })

    expect((fetch.mock.calls[0][1] as RequestInit).signal).toBe(abortController.signal)
  })

  it('surfaces the service error message and rejects empty results', async () => {
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ error: 'The model reached its response limit.' }, 502))
    vi.stubGlobal('fetch', fetch)
    await expect(generateDescription({ componentName: 'Badge', componentType: 'COMPONENT', properties: [] })).rejects.toThrow('response limit')

    fetch.mockResolvedValue(serviceResponse('not json', 500))
    await expect(generateDescription({ componentName: 'Badge', componentType: 'COMPONENT', properties: [] })).rejects.toThrow('Generation failed (500)')

    fetch.mockResolvedValue(serviceResponse({ description: '   ' }))
    await expect(generateDescription({ componentName: 'Badge', componentType: 'COMPONENT', properties: [] })).rejects.toThrow('No description was returned')
  })

  it('waits for Retry-After on rate limits and then succeeds', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn()
      .mockResolvedValueOnce(serviceResponse({ error: 'Too many requests.' }, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(serviceResponse({ description: 'Second try.' }))
    vi.stubGlobal('fetch', fetch)

    const pending = generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: [] })
    await vi.advanceTimersByTimeAsync(2000)

    expect(await pending).toBe('Second try.')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up after repeated rate limits with the service message', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ error: 'Too many requests. Wait a moment and try again.' }, 429, { 'Retry-After': '1' }))
    vi.stubGlobal('fetch', fetch)

    const pending = generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: [] })
    const outcome = pending.catch(error => error)
    await vi.advanceTimersByTimeAsync(5000)

    expect((await outcome).message).toContain('Too many requests')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('stops a retry wait when the batch is cancelled', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValue(serviceResponse({ error: 'busy' }, 503, { 'Retry-After': '10' }))
    vi.stubGlobal('fetch', fetch)
    const abortController = new AbortController()

    const pending = generateDescription({ componentName: 'Button', componentType: 'COMPONENT', properties: [], abortSignal: abortController.signal })
    const outcome = pending.catch(error => error)
    abortController.abort()
    await vi.advanceTimersByTimeAsync(0)

    expect((await outcome).name).toBe('AbortError')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('network allowlist', () => {
  it('matches the manifest allowlist to the generation endpoint', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))['figma-plugin']
    expect(manifest.networkAccess.allowedDomains).toEqual([new URL(GENERATION_ENDPOINT).origin])
  })
})
