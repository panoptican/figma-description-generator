/**
 * Cache service for storing generated descriptions
 * Uses Figma's clientStorage API for persistence
 */

export interface CacheEntry {
  description: string
  timestamp: number
}

export interface CacheKey {
  name: string
  type: string
  properties: string[]
  parentName?: string
  promptHash: string
  imageHash?: string
}

/**
 * Generate a simple hash from a string
 * Using a fast, non-cryptographic hash for cache keys
 */
export function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Generate a cache key string from component data
 */
export function generateCacheKey(key: CacheKey): string {
  const parts = [
    key.name,
    key.type,
    key.properties.sort().join('|'),
    key.parentName || '',
    key.promptHash,
    key.imageHash || ''
  ]
  return hashString(parts.join('::'))
}

/**
 * Generate hash for prompt configuration
 */
export function hashPromptConfig(
  customPrompt: string,
  customVariantPrompt: string,
  includeImage: boolean
): string {
  return hashString(`${customPrompt}::${customVariantPrompt}::${includeImage}`)
}

/**
 * Cache storage interface for UI-side in-memory cache
 * The actual persistence happens via Figma's clientStorage in main.ts
 */
export class DescriptionCache {
  private cache: Map<string, CacheEntry> = new Map()

  /**
   * Initialize cache from stored data
   */
  load(data: Record<string, CacheEntry>): void {
    this.cache = new Map(Object.entries(data))
  }

  /**
   * Get cache entry if exists
   */
  get(key: string): CacheEntry | undefined {
    return this.cache.get(key)
  }

  /**
   * Check if cache has entry
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * Set cache entry
   */
  set(key: string, description: string): void {
    this.cache.set(key, {
      description,
      timestamp: Date.now()
    })
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Export cache as plain object for storage
   */
  export(): Record<string, CacheEntry> {
    return Object.fromEntries(this.cache)
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size
  }
}
