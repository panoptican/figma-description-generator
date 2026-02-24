# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Event-driven plugin with layered separation between Figma API context (main thread) and UI context (sandboxed iframe).

**Key Characteristics:**
- Two-context communication model: main thread handles Figma API interactions, UI runs in isolated iframe
- Event-based messaging using `emit`/`on` from create-figma-plugin utilities
- Unidirectional data flow: main thread as authoritative source for component data and settings
- Stateful UI components with local state management for editing interactions
- Scoped component discovery (current page vs. all pages) determined at plugin initialization

## Layers

**Plugin Layer (Main Thread):**
- Purpose: Direct access to Figma API, component discovery, description persistence, image export
- Location: `src/main.ts`
- Contains: Plugin initialization, event handlers for UI-initiated actions, Figma node access and manipulation
- Depends on: Figma API, create-figma-plugin utilities, shared types
- Used by: UI layer (via event messaging)

**UI Layer:**
- Purpose: User interface rendering and interaction, local state management, keyboard shortcuts
- Location: `src/ui.tsx`, `src/components/App.tsx`
- Contains: Preact components, hooks, modal dialogs, component list rendering
- Depends on: Services layer, utilities, event handlers, create-figma-plugin UI components
- Used by: User interactions via mouse, keyboard, and form inputs

**Services Layer:**
- Purpose: AI provider integration, API communication, data validation
- Location: `src/services/ai.ts`, `src/services/validation.ts`
- Contains: Provider-specific API implementations (ChatGPT, Claude, Gemini), prompt building, API key validation
- Depends on: Shared types, fetch API
- Used by: App component for description generation

**Utilities Layer:**
- Purpose: Data transformation, export formatting, text normalization
- Location: `src/utils/export.ts`, `src/utils/text.ts`, `src/utils/filters.ts`
- Contains: CSV/JSON export logic, description validation and formatting, filtering helpers
- Depends on: Shared types
- Used by: App component, export modal

**Hooks Layer:**
- Purpose: Reusable UI logic and browser event handling
- Location: `src/hooks/useKeyboardShortcuts.ts`
- Contains: Keyboard shortcut detection and routing, platform-specific modifier key handling
- Depends on: Preact hooks
- Used by: App component

**Types Layer:**
- Purpose: Centralized type definitions and event contracts
- Location: `src/types.ts`
- Contains: Component data structures, settings schema, event handler interfaces
- Depends on: create-figma-plugin utilities (EventHandler)
- Used by: All other layers

## Data Flow

**Component Discovery:**

1. User selects "Current page" or "All pages" from Figma menu
2. `initPlugin(scope)` in `src/main.ts` launches UI with scope parameter
3. UI mounted, emits `LOAD_COMPONENTS` event to main thread
4. Main thread executes `getComponents(scope)` to traverse Figma tree with `findAllWithCriteria`
5. Extracts component metadata: name, type, properties, current description, page name
6. Special handling: Detects COMPONENT_SET nodes, extracts variant children (VARIANT type)
7. Main thread emits `COMPONENTS_LOADED` with full ComponentData array
8. App.tsx receives data, groups by page, renders ComponentList
9. User can filter by search, toggle variant visibility, expand/collapse pages

**Description Generation:**

1. User clicks "Generate" on single component or "Generate All" button
2. ComponentRow or handleGenerateAll calls `handleGenerate(component)`
3. `handleGenerate` optionally exports component image if `settings.includeImage` or `isIcon`
4. For images: emits `EXPORT_IMAGE` → main thread exports PNG via Figma API → emits `IMAGE_EXPORTED` with base64
5. Calls `generateDescription()` from ai.ts with provider, API key, component metadata, optional image
6. Provider handler (ChatGPT/Claude/Gemini) formats request and calls external API with prompt
7. Parses response, returns description text
8. App updates local component state, immediately emits `APPLY_DESCRIPTION` to main thread
9. Main thread sets `node.description` on Figma node
10. Main thread emits `DESCRIPTION_APPLIED` confirming success
11. UI updates error state if failure detected

**Settings Persistence:**

1. User changes settings in SettingsModal (provider, API key, custom prompts, toggles)
2. Modal calls `handleSaveSettings(newSettings)` with updated Settings object
3. App.tsx emits `SAVE_SETTINGS` to main thread with full settings payload
4. Main thread calls `saveSettingsAsync(settings)` (Figma ClientStorage API)
5. Main thread emits `SETTINGS_SAVED` confirmation
6. Settings also persisted locally in App state via `setSettings`
7. On next plugin launch: emits `LOAD_SETTINGS` → main thread loads from storage → emits `SETTINGS_LOADED`

**State Management:**

- **Main thread state**: Figma document structure (read-only via Figma API)
- **UI persistent state**: Settings (via Figma ClientStorage), icon overrides (via settings)
- **UI ephemeral state**: Current component list, search query, expanded rows, modal visibility, edit buffers
- **Synchronization**: Unidirectional from main thread (authoritative) → UI (display). UI updates persisted via explicit `SAVE_SETTINGS` and `APPLY_DESCRIPTION` events.

## Key Abstractions

**ComponentData:**
- Purpose: Unified representation of Figma component regardless of type (COMPONENT, COMPONENT_SET, VARIANT)
- Examples: `src/types.ts` interface definition
- Pattern: Includes metadata (id, name, type, properties, page) and state (currentDescription, previousDescription)

**EventHandler:**
- Purpose: Type-safe contracts for emit/on messaging between contexts
- Examples: `LoadComponentsHandler`, `ComponentsLoadedHandler`, `ApplyDescriptionHandler` in `src/types.ts`
- Pattern: Each event is bidirectional (request/response) or unidirectional with explicit naming (e.g., "LOADED", "APPLIED")

**Provider Abstraction:**
- Purpose: Isolate AI provider differences behind consistent interface
- Examples: `generateWithChatGPT`, `generateWithClaude`, `generateWithGemini` in `src/services/ai.ts`
- Pattern: Each provider implements same signature, router in `generateDescription` dispatches by provider enum

**Prompt Templates:**
- Purpose: Decouple prompt content from generation logic
- Examples: `DEFAULT_PROMPT`, `DEFAULT_VARIANT_PROMPT`, `DEFAULT_ICON_PROMPT` in `src/services/ai.ts`
- Pattern: Templated strings with `{placeholder}` syntax, `buildPrompt` handles substitution and variant selection

## Entry Points

**Plugin Initialization (Main Thread):**
- Location: `src/main.ts` exports `currentPage()` and `allPages()`
- Triggers: User clicks menu item in Figma
- Responsibilities: Initialize plugin context, show UI, set up event listeners, manage component discovery and persistence

**UI Initialization:**
- Location: `src/ui.tsx` exports default Preact render with `App` component
- Triggers: Plugin shows UI via `showUI()` call
- Responsibilities: Mount App with scope and currentPageName props, initialize event subscriptions, render component list

**Component Row Interaction:**
- Location: `src/components/ComponentRow.tsx`
- Triggers: User clicks Generate, expands row, edits description
- Responsibilities: Local state for edit buffer, auto-save after 800ms debounce, format description for display

## Error Handling

**Strategy:** Graceful degradation with user-facing error messages and fallback behaviors.

**Patterns:**

- **API Errors**: Provider calls wrapped in try/catch, parse response for specific error codes (401 auth, 429 rate limit, etc.). Validation.ts provides structured error messages. Errors stored in `rowErrors` state, displayed below description.

- **Figma API Errors**: Image export catches errors, returns `null` for imageBase64. Component apply catches exceptions, emits failure status. Main thread maintains fallback: if getNodeById returns null, emit `DESCRIPTION_APPLIED` with `success: false`.

- **Network Errors**: Validation timeout after 5 seconds with AbortController. Generation calls don't have explicit timeout (relies on provider timeout). Timeout/network errors surface as catch block → user sees generic error message.

- **State Inconsistency**: ComponentRow syncs with parent App via useEffect when `component.currentDescription` changes. If description fails to apply to canvas, local state updates proceed anyway (UI shows error), user can revert or retry.

- **Icon Detection**: Regex-based auto-detect (`/^icon\b/i.test(node.name)`). If regex fails or naming convention differs, user can manually toggle icon status in UI, stored in `iconOverrides`.

## Cross-Cutting Concerns

**Logging:** Uses `console.error()` and `console.log()` selectively. No dedicated logging framework. Errors logged to browser console in development, not persisted.

**Validation:**
- Input: API key validation via lightweight provider endpoint check (no tokens consumed)
- Output: Description length capped at 500 chars, empty descriptions rejected, CSV escaping handles special chars
- Type safety enforced via TypeScript at compile time

**Authentication:**
- API keys stored in Figma ClientStorage (per-user, persisted across sessions)
- Keys sent in request headers per provider spec (Authorization header for OpenAI/Claude, query param for Gemini)
- No key logging or exposure in UI; only checked for truthiness before enabling generation
- Settings modal shows key field but doesn't echo/display it (input type not specified, may show as plain text during entry)

**Icon Detection:**
- Auto-detect: Component name starts with "icon" (case-insensitive)
- Override system: `iconOverrides` state tracks manual toggles per component ID
- Persisted via settings as `Settings.iconOverrides` record
- Used to select icon prompt instead of default prompt in `buildPrompt()`

---

*Architecture analysis: 2026-02-24*
