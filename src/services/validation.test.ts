import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateApiKey } from './validation'

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('input validation', () => {
    it('returns error for empty API key', async () => {
      const result = await validateApiKey('chatgpt', '')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key is required')
    })

    it('returns error for whitespace-only API key', async () => {
      const result = await validateApiKey('chatgpt', '   ')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key is required')
    })
  })

  describe('ChatGPT validation', () => {
    it('returns valid for successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      })

      const promise = validateApiKey('chatgpt', 'sk-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer sk-test-key'
          }
        })
      )
    })

    it('returns invalid for 401 unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'Invalid API key provided' }
        }))
      })

      const promise = validateApiKey('chatgpt', 'invalid-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('returns invalid for 429 rate limited', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'Rate limit exceeded' }
        }))
      })

      const promise = validateApiKey('chatgpt', 'sk-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Rate limited - try again later')
    })
  })

  describe('Claude validation', () => {
    it('returns valid for successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Hello' }]
        })
      })

      const promise = validateApiKey('claude', 'sk-ant-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'sk-ant-test-key'
          })
        })
      )
    })

    it('returns invalid for 401 unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'Invalid API key' }
        }))
      })

      const promise = validateApiKey('claude', 'invalid-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('returns invalid for 403 forbidden', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'Permission denied' }
        }))
      })

      const promise = validateApiKey('claude', 'sk-ant-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key does not have access')
    })
  })

  describe('Gemini validation', () => {
    it('returns valid for successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      })

      const promise = validateApiKey('gemini', 'AIza-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=AIza-test-key',
        expect.objectContaining({
          method: 'GET'
        })
      )
    })

    it('returns invalid for 400 bad API key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'API key not valid. Please pass a valid API key.' }
        }))
      })

      const promise = validateApiKey('gemini', 'invalid-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('returns invalid for 403 forbidden', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve(JSON.stringify({
          error: { message: 'Permission denied' }
        }))
      })

      const promise = validateApiKey('gemini', 'AIza-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('API key does not have access')
    })
  })

  describe('timeout handling', () => {
    it('times out after 5 seconds', async () => {
      let abortSignal: AbortSignal | undefined

      global.fetch = vi.fn().mockImplementation((_url, options) => {
        abortSignal = options?.signal
        return new Promise((_, reject) => {
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }
        })
      })

      const promise = validateApiKey('chatgpt', 'sk-test-key')

      // Advance timers to trigger the 5 second timeout
      vi.advanceTimersByTime(5000)

      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Validation timed out after 5 seconds')
    })
  })

  describe('unknown provider', () => {
    it('returns error for unknown provider', async () => {
      const result = await validateApiKey('unknown' as any, 'test-key')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Unknown provider: unknown')
    })
  })

  describe('network errors', () => {
    it('handles network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const promise = validateApiKey('chatgpt', 'sk-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('malformed error responses', () => {
    it('handles non-JSON error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      })

      const promise = validateApiKey('chatgpt', 'sk-test-key')
      vi.runAllTimers()
      const result = await promise

      expect(result.valid).toBe(false)
      expect(result.error).toBe('HTTP 500: Internal Server Error')
    })
  })
})
