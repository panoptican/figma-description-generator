# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Environment: Node (not DOM, configured with `environment: 'node'`)

**Assertion Library:**
- Vitest built-in expect (chai-style assertions)
- Methods: `expect().toBe()`, `expect().toEqual()`, `expect().toHaveLength()`, `expect().toContain()`, etc.

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Run tests in watch mode (live reload)
# Coverage not configured (no coverage command in package.json)
```

## Test File Organization

**Location:**
- Co-located with source files (same directory)
- Pattern: filename matches source with `.test.ts` suffix
- Examples:
  - `src/utils/filters.ts` → `src/utils/filters.test.ts`
  - `src/utils/text.ts` → `src/utils/text.test.ts`
  - `src/services/ai.ts` → `src/services/ai.test.ts`
  - `src/hooks/useKeyboardShortcuts.ts` → `src/hooks/useKeyboardShortcuts.test.ts`

**Naming:**
- Test files: `*.test.ts` (not .spec.ts)
- Included in vitest glob: `src/**/*.test.ts`
- Excluded from TypeScript compilation (tsconfig.json: `"exclude": ["src/**/*.test.ts"]`)

**Structure:**
```
src/utils/filters.test.ts
src/services/ai.test.ts
src/hooks/useKeyboardShortcuts.test.ts
src/utils/export.test.ts
src/utils/text.test.ts
```

**Test count:** 6 test files covering ~21 source files (28% coverage by file count)

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest'
import { filterComponents, countMissingDescriptions } from './filters'
import { ComponentData } from '../types'

// Optional: Factory/helper function
const createComponent = (overrides: Partial<ComponentData> = {}): ComponentData => ({
  id: 'test-id',
  name: 'TestComponent',
  type: 'COMPONENT',
  properties: [],
  currentDescription: '',
  pageName: 'Page 1',
  ...overrides
})

describe('filterComponents', () => {
  describe('variant filtering', () => {
    it('includes variants when showVariants is true', () => {
      const components = [/* test data */]
      const result = filterComponents(components, { showVariants: true, searchValue: '' })
      expect(result).toHaveLength(3)
    })
  })

  describe('search filtering', () => {
    it('matches component name (case insensitive)', () => {
      // test case
    })
  })
})
```

**Patterns:**
- Import organization: vitest imports first, then source under test, then test utilities/types
- Nested describe blocks for logical grouping (e.g., "filterComponents" → "variant filtering" → "search filtering")
- One assertion per test typically, but multiple related assertions allowed
- Descriptive test names in `it()` that explain behavior, not implementation

## Mocking

**Framework:** Vitest `vi` module

**Patterns** (from `src/services/ai.test.ts`):
```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('generateDescription', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('returns trimmed ChatGPT response text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '  Generates a clear action label.  ' } }]
      })
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await generateDescription('chatgpt', 'key', 'Button', 'COMPONENT', ['size'])

    expect(result).toBe('Generates a clear action label.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
```

**Key aspects:**
- Save original before mocking: `const originalFetch = globalThis.fetch`
- Mock using `vi.fn().mockResolvedValue()` for async functions
- Restore in `afterEach`: `vi.restoreAllMocks()` and reset globals
- Mock return values typed as Response/objects as needed
- Call assertions after test execution (e.g., `expect(fetchMock).toHaveBeenCalledOnce()`)

**What to Mock:**
- External APIs (fetch calls to OpenAI, Google, Anthropic)
- Global objects (navigator.platform, globalThis.fetch)
- Browser APIs that won't work in Node environment

**What NOT to Mock:**
- Pure utility functions (test them directly)
- Data transformations (real behavior, not mocked)
- Type system (interfaces/types)

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function for consistent test data
const createComponent = (overrides: Partial<ComponentData> = {}): ComponentData => ({
  id: 'test-id',
  name: 'TestComponent',
  type: 'COMPONENT',
  properties: [],
  currentDescription: '',
  pageName: 'Page 1',
  ...overrides
})

// Usage in tests
const components = [
  createComponent({ id: '1', type: 'COMPONENT' }),
  createComponent({ id: '2', type: 'VARIANT' }),
  createComponent({ id: '3', type: 'COMPONENT_SET' })
]
```

**Pattern:** Object spread with overrides for flexibility (from `src/utils/filters.test.ts`)

**Mock Data Arrays:**
```typescript
// Realistic mock data sets (from src/utils/export.test.ts)
const mockComponents: ComponentData[] = [
  {
    id: '1:1',
    name: 'Button',
    type: 'COMPONENT',
    properties: [],
    currentDescription: 'A clickable button component',
    pageName: 'Components'
  },
  // ... more items
]
```

**Location:**
- Within test files (no separate fixtures directory)
- Declared at top of test file or in describe block
- Re-used across multiple test cases

## Coverage

**Requirements:** None enforced (no coverage configuration in vitest.config.ts)

**Current state:**
- 28% coverage by file count (6 of 21 source files have tests)
- Tested modules: utilities, services, hooks
- Untested: components (ComponentRow.tsx, App.tsx, etc.), main.ts

**Testable areas without tests:**
- Component integration logic in App.tsx (complex state management)
- ComponentRow UI interactions and lifecycle
- main.ts Figma plugin initialization and event handling
- SettingsModal, ExportModal, Header components

## Test Types

**Unit Tests:**
- Scope: Pure functions and utilities
- Approach: Test input/output, edge cases, error conditions
- Examples:
  - `filterComponents` with various filter combinations
  - `buildPrompt` with different component types
  - `validateDescription` with valid/invalid inputs
  - `parseVariantName` with edge cases

**Integration Tests:**
- Scope: API call handling with realistic mocked responses
- Approach: Mock fetch, test prompt building + API response parsing
- Example (from `src/services/ai.test.ts`):
```typescript
it('returns trimmed ChatGPT response text', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '  Generates a clear action label.  ' } }]
    })
  } as Response)
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const result = await generateDescription('chatgpt', 'key', 'Button', 'COMPONENT', ['size'])

  expect(result).toBe('Generates a clear action label.')
  expect(fetchMock).toHaveBeenCalledOnce()
})
```

**E2E Tests:**
- Framework: Not used (no e2e testing framework configured)
- Manual testing required in Figma plugin environment (noted in useKeyboardShortcuts.test.ts)

## Common Patterns

**Async Testing:**
```typescript
// Mark test function as async, use await
it('returns trimmed response text', async () => {
  const result = await generateDescription('chatgpt', 'key', 'Button', 'COMPONENT', ['size'])
  expect(result).toBe('Generates a clear action label.')
})

// Or with rejected promises
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
```

**Error Testing:**
```typescript
// Test error messages
it('returns error for empty string', () => {
  expect(validateDescription('')).toBe('Description cannot be empty')
})

// Test error thrown
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
```

**Navigator/Browser Mock Testing:**
```typescript
// Setup/teardown pattern for mocking browser APIs
const mockNavigator = (platform: string) => {
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true
  })
}

describe('getModifierKeyLabel', () => {
  const originalPlatform = navigator.platform

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  })

  it('returns ⌘ for Mac', () => {
    mockNavigator('MacIntel')
    expect(getModifierKeyLabel()).toBe('⌘')
  })
})
```

**Fake Timers Testing:**
```typescript
// For testing time-dependent code
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-01-27T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

it('generates CSV filename with date', () => {
  const filename = generateFilename('csv')
  expect(filename).toBe('component-descriptions-2025-01-27.csv')
})
```

**Edge Case Testing Pattern:**
Tests cover normal cases, edge cases, and error conditions:
```typescript
describe('filterComponents', () => {
  // Normal case
  it('includes variants when showVariants is true', () => { ... })

  // Edge case: empty results
  it('returns empty array when no matches', () => { ... })

  // Edge case: empty input
  // Implicitly tested via factory with empty defaults
})

describe('countMissingDescriptions', () => {
  it('returns 0 when all have descriptions', () => { ... })
  it('handles empty array', () => { ... })
})
```

## Test Execution Notes

- Tests run in Node environment (not jsdom or happy-dom)
- Component testing (Preact components) not implemented - manual testing in Figma plugin required
- No automated E2E testing - plugin must be tested manually in Figma's development mode
- Type checking enabled during build (`build-figma-plugin --typecheck`)
- No pre-commit hooks enforcing tests (inferred from absence in package.json)

---

*Testing analysis: 2026-02-24*
