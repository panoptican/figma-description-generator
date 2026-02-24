# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `ComponentRow.tsx`, `App.tsx`, `SettingsModal.tsx`)
- Utilities: camelCase (e.g., `filters.ts`, `text.ts`, `export.ts`)
- Hooks: camelCase with `use` prefix (e.g., `useKeyboardShortcuts.ts`)
- Tests: exact match to source file with `.test.ts` suffix (e.g., `filters.test.ts`)
- Type/interface files: `types.ts` (centralized)

**Functions:**
- Exported functions: camelCase (e.g., `filterComponents`, `generateDescription`, `buildPrompt`)
- Handler/callback names: descriptive with `handle` prefix (e.g., `handleGenerate`, `handleConfirm`, `handleToggleIcon`)
- Helper functions (non-exported): camelCase, sometimes prefixed with verbs (e.g., `extractComponentSetProperties`, `parseVariantName`, `truncateDescription`)
- Constant functions: camelCase (e.g., `getProviderDisplayName`, `getModifierKeyLabel`)

**Variables:**
- State variables: camelCase (e.g., `components`, `settings`, `searchValue`, `isLoading`)
- Boolean flags: camelCase with `is`/`has` prefix (e.g., `isExpanded`, `isDirty`, `hasDescription`, `hasApiKey`)
- Refs: camelCase with `Ref` suffix (e.g., `abortGenerateAllRef`, `imageExportResolvers`, `rowRef`, `searchInputRef`)
- Constants (objects/records): camelCase or UPPER_CASE for true constants (e.g., `DEFAULT_SETTINGS`, `DEFAULT_PROMPT`, `CONCURRENCY_LIMIT`)
- Loop variables: single letter or descriptive (e.g., `i`, `c`, `component`, `node`)

**Types:**
- Interfaces: PascalCase (e.g., `ComponentData`, `Settings`, `KeyboardShortcutHandlers`)
- Type aliases: PascalCase (e.g., `AIProvider`, `Scope`, `ExportFormat`)
- Generic type parameters: single uppercase letter or descriptive (e.g., `T`, `ContentBlock`)
- Event handlers: PascalCase with `Handler` suffix (e.g., `LoadComponentsHandler`, `DescriptionAppliedHandler`)

## Code Style

**Formatting:**
- No explicit formatter configured (no .prettierrc, eslint, or biome)
- Two-space indentation (observed in all source files)
- Single quotes for strings (observed in imports and string literals)
- Semicolons used (present in all statements)
- Line length: No enforced limit observed (lines vary 60-100+ chars)
- Trailing commas: Used in multi-line objects/arrays

**Indentation Pattern** (from `src/components/App.tsx`):
```typescript
// Two-space indentation consistently
const handleConfirm = useCallback((id: string, description: string) => {
  emit<ApplyDescriptionHandler>('APPLY_DESCRIPTION', { id, description })

  // Update local state
  setComponents((prev) =>
    prev.map((c) =>
      c.id === id
        ? {
            ...c,
            previousDescription: c.currentDescription,
            currentDescription: description
          }
        : c
    )
  )
  setRowErrors((prev) => ({ ...prev, [id]: undefined }))
}, [])
```

**String literals:**
- Use single quotes (e.g., `'COMPONENT'`, `'generateDescription'`)
- Template literals for dynamic content (e.g., `` `data:image/png;base64,${imageBase64}` ``)

## Import Organization

**Order:**
1. Framework/library imports (`preact`, `@create-figma-plugin/*`)
2. Type imports (from `../types`)
3. Service imports (from `../services/*`)
4. Utility imports (from `../utils/*`)
5. Component imports (from `./*` or `../components/*`)
6. Hook imports (from `../hooks/*`)

**Example from `src/components/App.tsx`:**
```typescript
import { emit, on } from '@create-figma-plugin/utilities'  // Library
import { h } from 'preact'                                 // Library
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'  // Library

import {                                                    // Types
  ApplyDescriptionHandler,
  ComponentData,
  // ...
} from '../types'
import {                                                    // Services
  generateDescription,
  DEFAULT_PROMPT,
  // ...
} from '../services/ai'
import { exportDescriptions, ExportFormat } from '../utils/export'  // Utilities
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'  // Hooks
import { Header } from './Header'                           // Components
import { SettingsModal } from './SettingsModal'
```

**Path Aliases:**
- Relative imports only (no @ aliases or path mappings used)
- Use `../` for parent directory navigation
- Use `./` for same-directory imports (components to other components)

## Error Handling

**Patterns:**
- Try/catch with specific error handling (from `src/components/App.tsx`):
```typescript
catch (error) {
  console.error(`Failed to generate for ${component.name}:`, error)
  setRowErrors((prev) => ({
    ...prev,
    [component.id]: error instanceof Error ? error.message : 'Generation failed'
  }))
}
```

- Error messages stored in state for UI display (e.g., `rowErrors` record, `setError`)
- Console.error for unhandled/critical failures (in `main.ts`, `App.tsx`)
- Graceful degradation: API failures emit error events but don't crash (from `src/main.ts`):
```typescript
} catch (error) {
  console.error('Failed to export image:', error)
  emit<ImageExportedHandler>('IMAGE_EXPORTED', { id, imageBase64: null })
}
```

- Validation errors: Return null/error message for failed validation (from `src/utils/text.ts`):
```typescript
export function validateDescription(description: string): string | null {
  const trimmed = description.trim()
  if (trimmed.length === 0) {
    return 'Description cannot be empty'
  }
  if (trimmed.length > 500) {
    return 'Description is too long (max 500 characters)'
  }
  return null
}
```

## Logging

**Framework:** Console methods (console.error)

**Patterns:**
- Only error logging implemented (console.error)
- Errors include context (component name, ID, operation)
- Error messages are descriptive with variables interpolated
- No info/debug/warn logging in current codebase

**Example** (from `src/components/App.tsx`):
```typescript
console.error(`Failed to generate for ${component.name}:`, error)
console.error(`Failed to apply description for component ${id}`)
```

## Comments

**When to Comment:**
- Document hooks and their behavior (from `src/hooks/useKeyboardShortcuts.ts`):
```typescript
/**
 * Hook for handling keyboard shortcuts throughout the application.
 * Uses Cmd on Mac and Ctrl on Windows.
 *
 * Shortcuts:
 * - Cmd/Ctrl+G: Generate description for selected component
 * - Cmd/Ctrl+Shift+G: Generate all descriptions
 * - Cmd/Ctrl+F: Focus search field
 * - Cmd/Ctrl+Z: Revert to previous description (when not in text field)
 * - Escape: Close settings modal if open
 */
```

- Document utility functions with JSDoc (from `src/utils/filters.ts`):
```typescript
/**
 * Filters components based on variant visibility and search criteria.
 * Search matches against component name, page name, and properties.
 */
export function filterComponents(
  components: ComponentData[],
  options: FilterOptions
): ComponentData[] {
```

- Inline comments for non-obvious logic or workarounds (from `src/main.ts`):
```typescript
// Clean up old cache data from previous versions
figma.clientStorage.deleteAsync('description-cache').catch(() => {})

// Fallback: extract from variant names
const variantProps = new Set<string>()
```

- Explain bug fixes with BUG-XXX references (from `src/components/App.tsx`):
```typescript
// BUG-001 fix: Map of resolvers keyed by component ID instead of single ref
const imageExportResolvers = useRef<Map<string, (value: string | null) => void>>(new Map())

// BUG-002 fix: queue-based approach instead of shared index
const queue = [...componentsToGenerate]
```

**JSDoc/TSDoc:**
- Used for exported functions and hooks
- Includes description, parameter types, and return types
- Documents special behavior or platform-specific notes
- Not used for private/internal functions
- Format: standard JSDoc multi-line comment blocks (/** ... */)

## Function Design

**Size:**
- Utility functions: Typically 5-20 lines (e.g., `filterComponents`, `parseVariantName`)
- Event handlers: 10-50 lines for simple, 50+ for complex ones (e.g., `handleGenerate`)
- Complex logic split into helper functions (e.g., `getComponents` broken into `extractComponentSetProperties`, `parseVariantName`)

**Parameters:**
- Use interfaces for complex parameter objects (from `src/utils/filters.ts`):
```typescript
export function filterComponents(
  components: ComponentData[],
  options: FilterOptions  // Grouped options interface
): ComponentData[]
```

- Destructure parameters (e.g., `{ showVariants, searchValue } = options`)
- Optional parameters use `?` (e.g., `parentName?: string`)
- Default parameters in function signatures where appropriate

**Return Values:**
- Explicit return types (TypeScript types enforced)
- Utility functions return primitives or typed objects (e.g., `ComponentData[]`, `Record<string, string>`)
- Async functions return Promises (e.g., `Promise<string>`)
- Validation functions return union types: null or error (e.g., `string | null`)
- Event handlers often return void or Promise<void>

## Module Design

**Exports:**
- Named exports for functions and types (not default exports)
- Each file has focused responsibility (utilities, services, components, hooks)
- Public API defined clearly (exported items at module level)

**Example** (from `src/services/ai.ts`):
```typescript
export const DEFAULT_PROMPT = `...`
export const DEFAULT_ICON_PROMPT = `...`
export const DEFAULT_VARIANT_PROMPT = `...`

export function getProviderDisplayName(provider: AIProvider): string { ... }
export function buildPrompt(...): string { ... }
export async function generateDescription(...): Promise<string> { ... }
```

**Barrel Files:**
- Not used (no index.ts re-export files observed)
- Direct imports from source files (e.g., `from '../services/ai'` not `from '../services'`)

## Component Props Pattern

**Props interfaces:** Defined in same file, PascalCase with `Props` suffix:
```typescript
interface ComponentRowProps {
  component: ComponentData
  onGenerate: (component: ComponentData) => Promise<string>
  onConfirm: (id: string, description: string) => void
  isSelected: boolean
  // ... more props
}
```

**Props handling:**
- Destructured in function parameters
- Type-safe with interface definitions
- Callback props prefixed with `on` (e.g., `onGenerate`, `onConfirm`)
- Boolean props prefixed with `is` or `has`

---

*Convention analysis: 2026-02-24*
