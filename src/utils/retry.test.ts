import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  withRetry,
  isRetryableError,
  getRetryAfterMs,
  calculateDelay,
  RetryError
} from './retry'

describe('isRetryableError', () => {
  describe('retryable errors', () => {
    it('returns true for network errors', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true)
      expect(isRetryableError(new Error('Failed to fetch'))).toBe(true)
      expect(isRetryableError(new Error('Connection refused'))).toBe(true)
    })

    it('returns true for timeout errors', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true)
      expect(isRetryableError(new Error('Timeout exceeded'))).toBe(true)
    })

    it('returns true for rate limit errors (429)', () => {
      expect(isRetryableError(new Error('HTTP 429: Too Many Requests'))).toBe(true)
      expect(isRetryableError(new Error('Error 429 rate limited'))).toBe(true)
    })

    it('returns true for server errors (5xx)', () => {
      expect(isRetryableError(new Error('HTTP 500 Internal Server Error'))).toBe(true)
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true)
      expect(isRetryableError(new Error('Error 502 Bad Gateway'))).toBe(true)
    })

    it('returns true for unknown errors (defaults to retryable)', () => {
      expect(isRetryableError(new Error('Something went wrong'))).toBe(true)
    })
  })

  describe('non-retryable errors', () => {
    it('returns false for auth errors (401)', () => {
      expect(isRetryableError(new Error('HTTP 401 Unauthorized'))).toBe(false)
    })

    it('returns false for forbidden errors (403)', () => {
      expect(isRetryableError(new Error('HTTP 403 Forbidden'))).toBe(false)
    })

    it('returns false for bad request errors (400)', () => {
      expect(isRetryableError(new Error('HTTP 400 Bad Request'))).toBe(false)
    })

    it('returns false for not found errors (404)', () => {
      expect(isRetryableError(new Error('HTTP 404 Not Found'))).toBe(false)
    })

    it('returns false for invalid API key errors', () => {
      expect(isRetryableError(new Error('Invalid API key'))).toBe(false)
      expect(isRetryableError(new Error('Invalid key provided'))).toBe(false)
    })

    it('returns false for authentication errors', () => {
      expect(isRetryableError(new Error('Authentication failed'))).toBe(false)
      expect(isRetryableError(new Error('Unauthorized access'))).toBe(false)
    })
  })
})

describe('getRetryAfterMs', () => {
  it('extracts retry-after value in seconds', () => {
    expect(getRetryAfterMs(new Error('retry-after: 5'))).toBe(5000)
    expect(getRetryAfterMs(new Error('Retry-After: 10'))).toBe(10000)
    expect(getRetryAfterMs(new Error('retryafter: 3'))).toBe(3000)
  })

  it('returns null when no retry-after found', () => {
    expect(getRetryAfterMs(new Error('Rate limited'))).toBe(null)
    expect(getRetryAfterMs(new Error('Too many requests'))).toBe(null)
  })
})

describe('calculateDelay', () => {
  it('calculates exponential backoff correctly', () => {
    const baseDelay = 1000

    expect(calculateDelay(1, baseDelay)).toBe(1000)  // 1s
    expect(calculateDelay(2, baseDelay)).toBe(2000)  // 2s
    expect(calculateDelay(3, baseDelay)).toBe(4000)  // 4s
    expect(calculateDelay(4, baseDelay)).toBe(8000)  // 8s
  })

  it('works with different base delays', () => {
    expect(calculateDelay(1, 500)).toBe(500)
    expect(calculateDelay(2, 500)).toBe(1000)
    expect(calculateDelay(3, 500)).toBe(2000)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const resultPromise = withRetry(fn)
    const result = await resultPromise

    expect(result).toEqual({
      data: 'success',
      attempts: 1,
      fromRetry: false
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success')

    const resultPromise = withRetry(fn)

    // Advance past first retry delay
    await vi.advanceTimersByTimeAsync(1000)

    const result = await resultPromise

    expect(result).toEqual({
      data: 'success',
      attempts: 2,
      fromRetry: true
    })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries multiple times before succeeding', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce('success')

    const resultPromise = withRetry(fn)

    // Advance past first retry delay (1s)
    await vi.advanceTimersByTimeAsync(1000)
    // Advance past second retry delay (2s)
    await vi.advanceTimersByTimeAsync(2000)

    const result = await resultPromise

    expect(result).toEqual({
      data: 'success',
      attempts: 3,
      fromRetry: true
    })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('fails immediately on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP 401 Unauthorized'))

    await expect(withRetry(fn)).rejects.toThrow(RetryError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws RetryError with correct properties after max attempts', async () => {
    vi.useRealTimers() // Use real timers for simpler rejection handling
    const fn = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RetryError)
      const retryError = err as RetryError
      expect(retryError.attempts).toBe(3)
      expect(retryError.isRetryable).toBe(true)
      expect(retryError.message).toContain('Failed after 3 attempts')
      return true
    })

    expect(fn).toHaveBeenCalledTimes(3)
    vi.useFakeTimers() // Restore fake timers
  })

  it('calls onRetry callback on each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce('success')

    const onRetry = vi.fn()

    const resultPromise = withRetry(fn, { onRetry })

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)

    await resultPromise

    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 3, expect.any(Error))
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 3, expect.any(Error))
  })

  it('aborts when shouldAbort returns true before first attempt', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'))
    const shouldAbort = () => true // Already aborted

    await expect(withRetry(fn, { shouldAbort })).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RetryError)
      expect((err as RetryError).message).toContain('aborted')
      return true
    })
    expect(fn).toHaveBeenCalledTimes(0) // Should abort before any attempt
  })

  it('aborts when shouldAbort returns true during retry', async () => {
    vi.useRealTimers() // Use real timers for simpler abort handling
    let callCount = 0
    const fn = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.reject(new Error('Network error'))
    })
    const shouldAbort = () => callCount >= 1 // Abort after first call

    await expect(withRetry(fn, { shouldAbort, baseDelayMs: 10 })).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(RetryError)
      expect((err as RetryError).message).toContain('aborted')
      return true
    })
    expect(fn).toHaveBeenCalledTimes(1) // Only one attempt before abort
    vi.useFakeTimers() // Restore fake timers
  })

  it('respects Retry-After header', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Rate limited, retry-after: 5'))
      .mockResolvedValueOnce('success')

    const resultPromise = withRetry(fn)

    // Should wait 5 seconds (from Retry-After), not 1 second (default)
    await vi.advanceTimersByTimeAsync(4000)
    expect(fn).toHaveBeenCalledTimes(1) // Still waiting

    await vi.advanceTimersByTimeAsync(1000)
    const result = await resultPromise

    expect(result.data).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('uses custom maxAttempts', async () => {
    vi.useRealTimers() // Use real timers for simpler rejection handling
    const fn = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toSatisfy((err: unknown) => {
      expect((err as RetryError).attempts).toBe(2)
      return true
    })

    expect(fn).toHaveBeenCalledTimes(2)
    vi.useFakeTimers() // Restore fake timers
  })

  it('uses custom baseDelayMs', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success')

    const resultPromise = withRetry(fn, { baseDelayMs: 500 })

    await vi.advanceTimersByTimeAsync(500)
    const result = await resultPromise

    expect(result.data).toBe('success')
  })
})

describe('RetryError', () => {
  it('contains correct properties', () => {
    const lastError = new Error('Original error')
    const retryError = new RetryError('Failed after 3 attempts', 3, lastError, true)

    expect(retryError.name).toBe('RetryError')
    expect(retryError.message).toBe('Failed after 3 attempts')
    expect(retryError.attempts).toBe(3)
    expect(retryError.lastError).toBe(lastError)
    expect(retryError.isRetryable).toBe(true)
  })

  it('is instanceof Error', () => {
    const retryError = new RetryError('test', 1, new Error(), false)
    expect(retryError).toBeInstanceOf(Error)
    expect(retryError).toBeInstanceOf(RetryError)
  })
})
