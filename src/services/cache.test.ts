import { describe, it, expect, beforeEach } from 'vitest'
import {
  hashString,
  generateCacheKey,
  hashPromptConfig,
  DescriptionCache,
  CacheKey
} from './cache'

describe('hashString', () => {
  it('produces consistent hash for same input', () => {
    const hash1 = hashString('test string')
    const hash2 = hashString('test string')
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different inputs', () => {
    const hash1 = hashString('string one')
    const hash2 = hashString('string two')
    expect(hash1).not.toBe(hash2)
  })

  it('handles empty string', () => {
    const hash = hashString('')
    expect(hash).toBe('0')
  })

  it('handles long strings', () => {
    const longString = 'a'.repeat(10000)
    const hash = hashString(longString)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('handles special characters', () => {
    const hash = hashString('Special chars: !@#$%^&*()_+{}[]|\\:";\'<>?,./`~')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })
})

describe('generateCacheKey', () => {
  it('generates consistent key for same component data', () => {
    const key: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size', 'variant'],
      promptHash: 'abc123'
    }
    const cacheKey1 = generateCacheKey(key)
    const cacheKey2 = generateCacheKey(key)
    expect(cacheKey1).toBe(cacheKey2)
  })

  it('generates different keys for different names', () => {
    const key1: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size'],
      promptHash: 'abc123'
    }
    const key2: CacheKey = {
      name: 'Card',
      type: 'COMPONENT',
      properties: ['size'],
      promptHash: 'abc123'
    }
    expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key2))
  })

  it('generates different keys for different types', () => {
    const key1: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size'],
      promptHash: 'abc123'
    }
    const key2: CacheKey = {
      name: 'Button',
      type: 'COMPONENT_SET',
      properties: ['size'],
      promptHash: 'abc123'
    }
    expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key2))
  })

  it('generates different keys for different properties', () => {
    const key1: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size', 'variant'],
      promptHash: 'abc123'
    }
    const key2: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size', 'color'],
      promptHash: 'abc123'
    }
    expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key2))
  })

  it('sorts properties for consistent keys regardless of order', () => {
    const key1: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size', 'variant'],
      promptHash: 'abc123'
    }
    const key2: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['variant', 'size'],
      promptHash: 'abc123'
    }
    expect(generateCacheKey(key1)).toBe(generateCacheKey(key2))
  })

  it('generates different keys for different prompt hashes', () => {
    const key1: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size'],
      promptHash: 'prompt1'
    }
    const key2: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size'],
      promptHash: 'prompt2'
    }
    expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key2))
  })

  it('handles optional parentName', () => {
    const key1: CacheKey = {
      name: 'size=large',
      type: 'VARIANT',
      properties: ['size'],
      parentName: 'Button',
      promptHash: 'abc123'
    }
    const key2: CacheKey = {
      name: 'size=large',
      type: 'VARIANT',
      properties: ['size'],
      parentName: 'Card',
      promptHash: 'abc123'
    }
    expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key2))
  })

  it('handles optional imageHash', () => {
    const key1: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size'],
      promptHash: 'abc123',
      imageHash: 'img123'
    }
    const key2: CacheKey = {
      name: 'Button',
      type: 'COMPONENT',
      properties: ['size'],
      promptHash: 'abc123',
      imageHash: 'img456'
    }
    expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key2))
  })

  it('handles empty properties array', () => {
    const key: CacheKey = {
      name: 'Icon',
      type: 'COMPONENT',
      properties: [],
      promptHash: 'abc123'
    }
    const cacheKey = generateCacheKey(key)
    expect(typeof cacheKey).toBe('string')
    expect(cacheKey.length).toBeGreaterThan(0)
  })
})

describe('hashPromptConfig', () => {
  it('produces consistent hash for same config', () => {
    const hash1 = hashPromptConfig('prompt1', 'variantPrompt1', true)
    const hash2 = hashPromptConfig('prompt1', 'variantPrompt1', true)
    expect(hash1).toBe(hash2)
  })

  it('produces different hash for different custom prompt', () => {
    const hash1 = hashPromptConfig('prompt1', 'variantPrompt', true)
    const hash2 = hashPromptConfig('prompt2', 'variantPrompt', true)
    expect(hash1).not.toBe(hash2)
  })

  it('produces different hash for different variant prompt', () => {
    const hash1 = hashPromptConfig('prompt', 'variantPrompt1', true)
    const hash2 = hashPromptConfig('prompt', 'variantPrompt2', true)
    expect(hash1).not.toBe(hash2)
  })

  it('produces different hash for different includeImage setting', () => {
    const hash1 = hashPromptConfig('prompt', 'variantPrompt', true)
    const hash2 = hashPromptConfig('prompt', 'variantPrompt', false)
    expect(hash1).not.toBe(hash2)
  })

  it('handles empty strings', () => {
    const hash = hashPromptConfig('', '', false)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })
})

describe('DescriptionCache', () => {
  let cache: DescriptionCache

  beforeEach(() => {
    cache = new DescriptionCache()
  })

  describe('basic operations', () => {
    it('starts empty', () => {
      expect(cache.size).toBe(0)
    })

    it('can set and get entries', () => {
      cache.set('key1', 'description1')
      const entry = cache.get('key1')
      expect(entry).toBeDefined()
      expect(entry?.description).toBe('description1')
    })

    it('returns undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('can check if key exists', () => {
      cache.set('key1', 'description1')
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(false)
    })

    it('tracks size correctly', () => {
      expect(cache.size).toBe(0)
      cache.set('key1', 'description1')
      expect(cache.size).toBe(1)
      cache.set('key2', 'description2')
      expect(cache.size).toBe(2)
    })

    it('overwrites existing entries', () => {
      cache.set('key1', 'original')
      cache.set('key1', 'updated')
      expect(cache.get('key1')?.description).toBe('updated')
      expect(cache.size).toBe(1)
    })

    it('stores timestamp with entries', () => {
      const before = Date.now()
      cache.set('key1', 'description1')
      const after = Date.now()

      const entry = cache.get('key1')
      expect(entry?.timestamp).toBeGreaterThanOrEqual(before)
      expect(entry?.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('clear', () => {
    it('removes all entries', () => {
      cache.set('key1', 'description1')
      cache.set('key2', 'description2')
      expect(cache.size).toBe(2)

      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(false)
    })
  })

  describe('load and export', () => {
    it('can export cache as plain object', () => {
      cache.set('key1', 'description1')
      cache.set('key2', 'description2')

      const exported = cache.export()
      expect(exported).toHaveProperty('key1')
      expect(exported).toHaveProperty('key2')
      expect(exported['key1'].description).toBe('description1')
      expect(exported['key2'].description).toBe('description2')
    })

    it('can load cache from plain object', () => {
      const data = {
        'key1': { description: 'desc1', timestamp: 1000 },
        'key2': { description: 'desc2', timestamp: 2000 }
      }

      cache.load(data)
      expect(cache.size).toBe(2)
      expect(cache.get('key1')?.description).toBe('desc1')
      expect(cache.get('key2')?.description).toBe('desc2')
      expect(cache.get('key1')?.timestamp).toBe(1000)
    })

    it('load replaces existing cache', () => {
      cache.set('existing', 'old value')

      cache.load({
        'new': { description: 'new value', timestamp: 1000 }
      })

      expect(cache.has('existing')).toBe(false)
      expect(cache.has('new')).toBe(true)
    })

    it('round-trips correctly', () => {
      cache.set('key1', 'description1')
      cache.set('key2', 'description2')

      const exported = cache.export()
      const newCache = new DescriptionCache()
      newCache.load(exported)

      expect(newCache.size).toBe(2)
      expect(newCache.get('key1')?.description).toBe('description1')
      expect(newCache.get('key2')?.description).toBe('description2')
    })
  })
})
