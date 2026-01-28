import { AIProvider, ProviderConfig } from '../types'

export interface FallbackResult {
  description: string
  usedProvider: AIProvider
  fallbackUsed: boolean
  attempts: number
}

export interface FallbackOptions {
  onProviderAttempt?: (provider: AIProvider, attemptNumber: number) => void
  onProviderFailed?: (provider: AIProvider, error: Error) => void
  shouldAbort?: () => boolean
}

/**
 * Determines if an error should trigger fallback to the next provider.
 * Auth errors should NOT trigger fallback (wrong key won't work elsewhere).
 * Rate limits and availability errors SHOULD trigger fallback.
 *
 * Note: This is intentionally more conservative than isRetryableError.
 * Retry tries again with the same provider, fallback switches providers.
 * For unknown errors, we retry (optimistic) but don't fallback (conservative).
 */
export function shouldFallback(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Auth errors - don't fallback
  if (
    message.includes('invalid api key') ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('api key not valid') ||
    message.includes('incorrect api key')
  ) {
    return false
  }

  // 401/403 errors in the message - don't fallback
  if (message.includes('401') || message.includes('403')) {
    return false
  }

  // Availability/transient errors - fallback
  if (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('timeout') ||
    message.includes('service unavailable') ||
    message.includes('503') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('network') ||
    message.includes('connection')
  ) {
    return true
  }

  // Unknown errors - don't fallback by default to avoid confusing error messages
  return false
}

/**
 * Get the list of providers to try, in order.
 * Returns only providers with valid API keys configured.
 */
export function getProviderChain(
  providerChain: ProviderConfig[] | undefined,
  primaryProvider: AIProvider,
  primaryApiKey: string
): { provider: AIProvider; apiKey: string }[] {
  // If no provider chain configured or fallback not enabled, just use primary
  if (!providerChain || providerChain.length === 0) {
    if (primaryApiKey.trim()) {
      return [{ provider: primaryProvider, apiKey: primaryApiKey }]
    }
    return []
  }

  // Filter to enabled providers with valid API keys
  const validProviders = providerChain
    .filter(config => config.enabled && config.apiKey.trim())
    .map(config => ({ provider: config.provider, apiKey: config.apiKey }))

  // If primary provider isn't in the chain, add it first (if it has a key)
  const hasPrimary = validProviders.some(p => p.provider === primaryProvider)
  if (!hasPrimary && primaryApiKey.trim()) {
    return [{ provider: primaryProvider, apiKey: primaryApiKey }, ...validProviders]
  }

  return validProviders
}

/**
 * Get a human-readable name for a provider.
 */
export function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case 'chatgpt':
      return 'ChatGPT'
    case 'claude':
      return 'Claude'
    case 'gemini':
      return 'Gemini'
    default:
      return provider
  }
}
