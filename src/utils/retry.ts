/**
 * Retry utility with exponential backoff for API calls
 */

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  onRetry?: (attempt: number, maxAttempts: number, error: Error) => void
  shouldAbort?: () => boolean
}

export interface RetryResult<T> {
  data: T
  attempts: number
  fromRetry: boolean
}

export class RetryError extends Error {
  public readonly attempts: number
  public readonly lastError: Error
  public readonly isRetryable: boolean

  constructor(message: string, attempts: number, lastError: Error, isRetryable: boolean) {
    super(message)
    this.name = 'RetryError'
    this.attempts = attempts
    this.lastError = lastError
    this.isRetryable = isRetryable
  }
}

/**
 * Determines if an error is retryable based on HTTP status and error type
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Network errors are retryable
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('connection')
  ) {
    return true
  }

  // Parse HTTP status from error message
  const statusMatch = message.match(/(\d{3})/)
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10)

    // Rate limits (429) are retryable
    if (status === 429) {
      return true
    }

    // Server errors (5xx) are retryable
    if (status >= 500 && status < 600) {
      return true
    }

    // Client errors (4xx except 429) are NOT retryable
    // This includes auth errors (401, 403), bad requests (400), not found (404)
    if (status >= 400 && status < 500) {
      return false
    }
  }

  // Check for specific provider error patterns
  // Auth errors are not retryable
  if (
    message.includes('invalid') && message.includes('key') ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('forbidden') ||
    message.includes('api key')
  ) {
    return false
  }

  // Default to retryable for unknown errors (network issues, etc.)
  return true
}

/**
 * Extracts Retry-After header value from error message if present
 */
export function getRetryAfterMs(error: Error): number | null {
  const message = error.message.toLowerCase()

  // Look for retry-after in error message
  const retryAfterMatch = message.match(/retry[- ]?after[:\s]+(\d+)/i)
  if (retryAfterMatch) {
    const seconds = parseInt(retryAfterMatch[1], 10)
    return seconds * 1000
  }

  return null
}

/**
 * Calculate delay for exponential backoff
 * Delays: 1s, 2s, 4s for attempts 1, 2, 3
 */
export function calculateDelay(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * Math.pow(2, attempt - 1)
}

/**
 * Wait for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with automatic retry on retryable errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    onRetry,
    shouldAbort
  } = options

  let lastError: Error = new Error('Unknown error')
  let attempts = 0

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt

    // Check for abort before attempting
    if (shouldAbort?.()) {
      throw new RetryError(
        'Retry aborted by user',
        attempts,
        lastError,
        false
      )
    }

    try {
      const data = await fn()
      return {
        data,
        attempts,
        fromRetry: attempt > 1
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If not retryable, fail immediately
      if (!isRetryableError(lastError)) {
        throw new RetryError(
          lastError.message,
          attempts,
          lastError,
          false
        )
      }

      // If this was the last attempt, fail
      if (attempt >= maxAttempts) {
        throw new RetryError(
          `Failed after ${attempts} attempts: ${lastError.message}`,
          attempts,
          lastError,
          true
        )
      }

      // Check for abort before waiting
      if (shouldAbort?.()) {
        throw new RetryError(
          'Retry aborted by user',
          attempts,
          lastError,
          false
        )
      }

      // Calculate delay - respect Retry-After header if present
      const retryAfter = getRetryAfterMs(lastError)
      const delay = retryAfter ?? calculateDelay(attempt, baseDelayMs)

      // Notify about retry
      onRetry?.(attempt, maxAttempts, lastError)

      // Wait before retrying
      await sleep(delay)
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new RetryError(
    `Failed after ${attempts} attempts: ${lastError.message}`,
    attempts,
    lastError,
    true
  )
}
