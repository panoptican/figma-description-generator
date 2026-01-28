import { describe, it, expect } from 'vitest'
import { shouldFallback, getProviderChain, getProviderDisplayName } from './fallback'
import { ProviderConfig } from '../types'

describe('shouldFallback', () => {
  describe('auth errors - should NOT fallback', () => {
    it('returns false for "invalid api key" error', () => {
      const error = new Error('Invalid API key provided')
      expect(shouldFallback(error)).toBe(false)
    })

    it('returns false for "unauthorized" error', () => {
      const error = new Error('Unauthorized access')
      expect(shouldFallback(error)).toBe(false)
    })

    it('returns false for "authentication" error', () => {
      const error = new Error('Authentication failed')
      expect(shouldFallback(error)).toBe(false)
    })

    it('returns false for "api key not valid" error', () => {
      const error = new Error('API key not valid')
      expect(shouldFallback(error)).toBe(false)
    })

    it('returns false for 401 error', () => {
      const error = new Error('HTTP 401: Unauthorized')
      expect(shouldFallback(error)).toBe(false)
    })

    it('returns false for 403 error', () => {
      const error = new Error('HTTP 403: Forbidden')
      expect(shouldFallback(error)).toBe(false)
    })
  })

  describe('availability errors - should fallback', () => {
    it('returns true for rate limit error', () => {
      const error = new Error('Rate limit exceeded')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for 429 error', () => {
      const error = new Error('HTTP 429: Too Many Requests')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for timeout error', () => {
      const error = new Error('Request timeout')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for service unavailable error', () => {
      const error = new Error('Service unavailable')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for 503 error', () => {
      const error = new Error('HTTP 503: Service Unavailable')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for 500 error', () => {
      const error = new Error('HTTP 500: Internal Server Error')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for 502 error', () => {
      const error = new Error('HTTP 502: Bad Gateway')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for network error', () => {
      const error = new Error('Network error')
      expect(shouldFallback(error)).toBe(true)
    })

    it('returns true for connection error', () => {
      const error = new Error('Connection refused')
      expect(shouldFallback(error)).toBe(true)
    })
  })

  describe('unknown errors - should NOT fallback', () => {
    it('returns false for unknown error', () => {
      const error = new Error('Something went wrong')
      expect(shouldFallback(error)).toBe(false)
    })
  })
})

describe('getProviderChain', () => {
  it('returns primary provider only when no chain configured', () => {
    const chain = getProviderChain(undefined, 'chatgpt', 'sk-test-key')
    expect(chain).toEqual([{ provider: 'chatgpt', apiKey: 'sk-test-key' }])
  })

  it('returns empty array when no API key provided', () => {
    const chain = getProviderChain(undefined, 'chatgpt', '')
    expect(chain).toEqual([])
  })

  it('returns empty array for empty provider chain', () => {
    const chain = getProviderChain([], 'chatgpt', '')
    expect(chain).toEqual([])
  })

  it('filters out disabled providers', () => {
    const providerChain: ProviderConfig[] = [
      { provider: 'chatgpt', apiKey: 'sk-1', enabled: true },
      { provider: 'claude', apiKey: 'sk-2', enabled: false },
      { provider: 'gemini', apiKey: 'sk-3', enabled: true }
    ]
    const chain = getProviderChain(providerChain, 'chatgpt', 'sk-1')
    expect(chain).toEqual([
      { provider: 'chatgpt', apiKey: 'sk-1' },
      { provider: 'gemini', apiKey: 'sk-3' }
    ])
  })

  it('filters out providers without API keys', () => {
    const providerChain: ProviderConfig[] = [
      { provider: 'chatgpt', apiKey: 'sk-1', enabled: true },
      { provider: 'claude', apiKey: '', enabled: true },
      { provider: 'gemini', apiKey: 'sk-3', enabled: true }
    ]
    const chain = getProviderChain(providerChain, 'chatgpt', 'sk-1')
    expect(chain).toEqual([
      { provider: 'chatgpt', apiKey: 'sk-1' },
      { provider: 'gemini', apiKey: 'sk-3' }
    ])
  })

  it('preserves provider order from chain', () => {
    const providerChain: ProviderConfig[] = [
      { provider: 'gemini', apiKey: 'sk-3', enabled: true },
      { provider: 'claude', apiKey: 'sk-2', enabled: true },
      { provider: 'chatgpt', apiKey: 'sk-1', enabled: true }
    ]
    const chain = getProviderChain(providerChain, 'chatgpt', 'sk-1')
    expect(chain).toEqual([
      { provider: 'gemini', apiKey: 'sk-3' },
      { provider: 'claude', apiKey: 'sk-2' },
      { provider: 'chatgpt', apiKey: 'sk-1' }
    ])
  })

  it('adds primary provider first if not in chain', () => {
    const providerChain: ProviderConfig[] = [
      { provider: 'claude', apiKey: 'sk-2', enabled: true },
      { provider: 'gemini', apiKey: 'sk-3', enabled: true }
    ]
    const chain = getProviderChain(providerChain, 'chatgpt', 'sk-1')
    expect(chain).toEqual([
      { provider: 'chatgpt', apiKey: 'sk-1' },
      { provider: 'claude', apiKey: 'sk-2' },
      { provider: 'gemini', apiKey: 'sk-3' }
    ])
  })

  it('does not add primary provider if it has no API key', () => {
    const providerChain: ProviderConfig[] = [
      { provider: 'claude', apiKey: 'sk-2', enabled: true },
      { provider: 'gemini', apiKey: 'sk-3', enabled: true }
    ]
    const chain = getProviderChain(providerChain, 'chatgpt', '')
    expect(chain).toEqual([
      { provider: 'claude', apiKey: 'sk-2' },
      { provider: 'gemini', apiKey: 'sk-3' }
    ])
  })
})

describe('getProviderDisplayName', () => {
  it('returns "ChatGPT" for chatgpt', () => {
    expect(getProviderDisplayName('chatgpt')).toBe('ChatGPT')
  })

  it('returns "Claude" for claude', () => {
    expect(getProviderDisplayName('claude')).toBe('Claude')
  })

  it('returns "Gemini" for gemini', () => {
    expect(getProviderDisplayName('gemini')).toBe('Gemini')
  })
})
