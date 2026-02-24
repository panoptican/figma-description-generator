# Codebase Concerns

**Analysis Date:** 2026-02-24

## Known Bugs (In Progress Fixes)

**BUG-001: Image Export Race Condition**
- Issue: Single ref stores promise resolvers for concurrent image exports. When multiple components request images simultaneously, resolvers overwrite each other, causing requests to hang.
- Files: `src/components/App.tsx:65, 70-75, 119-128`
- Impact:
  - Memory leaks from unresolved promises
  - Hung operations when processing 3+ concurrent components with image inclusion
  - Silent failures with no error thrown
- Status: FIXED - Now uses `Map<string, resolver>` keyed by component ID
- Fix approach: Already implemented - replaced single `imageExportResolveRef` with `imageExportResolvers` Map that stores resolvers indexed by component ID

**BUG-002: Concurrent Generation Index Race Condition**
- Issue: "Generate All" worker system uses shared `currentIndex` variable without synchronization. Multiple workers may process the same component index or skip components entirely.
- Files: `src/components/App.tsx:326-376`
- Impact:
  - Duplicate API calls for the same component (costs money)
  - Some components skipped entirely (missing descriptions)
  - Incorrect progress bar state
  - Most visible with 50+ component documents
- Status: FIXED - Now uses queue-based approach
- Fix approach: Already implemented - replaced shared index with `queue = [...componentsToGenerate]` and uses `queue.shift()` for atomic access

**BUG-003: Icon Overrides Not Persisted**
- Issue: Manual icon mode toggles stored in component state but never saved to Figma settings. Closing/reopening plugin loses all manual classifications.
- Files: `src/components/App.tsx:62, 92-95, 211-231`, `src/types.ts:27`
- Impact:
  - Poor UX - users must re-toggle icon mode every session
  - Inconsistent behavior - auto-detected icons persist, manual overrides don't
  - Users lose work between sessions
- Status: FIXED - Icon overrides now saved to Settings
- Fix approach: Already implemented - `iconOverrides` added to Settings interface, loaded from settings on init (line 93-95), and saved when toggled (line 225-227)

## Test Coverage Gaps

**Untested UI Components:**
- `src/components/App.tsx` - Core component with complex state management, multiple event handlers, concurrent operations. No tests.
  - Risk: Changes to state management, effect cleanup, or event handling could break silently
  - Priority: HIGH - This is the critical business logic layer

- `src/components/ComponentRow.tsx` - Manages individual component UI, expand/collapse, editing, generation. No tests.
  - Risk: Text editing, save debouncing, and expand/collapse logic fragile to refactors
  - Priority: HIGH - Heavily used UI component

- `src/components/ComponentList.tsx` - List rendering, filtering, expansion state. No tests.
  - Risk: Filtering logic or list performance regressions undetected
  - Priority: MEDIUM

- `src/components/SettingsModal.tsx` - Settings form, API key input, validation display. No tests.
  - Risk: Settings save/load issues or validation logic failures
  - Priority: MEDIUM

- `src/components/Header.tsx` - Search input, buttons, progress display. No tests.
  - Risk: Button event handling or search filter regressions
  - Priority: MEDIUM

- `src/components/ExportModal.tsx` - Export format selection and trigger. No tests.
  - Risk: Export functionality issues
  - Priority: LOW

**Untested Core Logic:**
- `src/main.ts` - Figma API interactions (component loading, description application, image export, settings persistence). No tests.
  - Risk: Figma integration changes could break unexpectedly
  - Priority: HIGH - Foundation of plugin functionality

- `src/hooks/useKeyboardShortcuts.ts` - Keyboard event handling. Has tests but incomplete coverage.
  - Risk: Keyboard interactions could break silently
  - Priority: MEDIUM

**Untested Utilities:**
- `src/utils/filters.ts` - Component filtering logic. Has tests.
- `src/utils/text.ts` - Text processing. Has tests.
- `src/utils/export.ts` - Export data preparation. Has tests.

**Test Framework Present:**
- Config: `vitest.config.ts`
- Run: `npm test`
- Current coverage: ~200 lines of test code for ~4,000 lines of source

## Security Considerations

**API Key Handling:**
- Risk: API keys stored in Figma client storage (plaintext)
- Current mitigation: Figma settings are per-user and not synced; users responsible for key security
- Files: `src/types.ts:20`, `src/main.ts:154-158`
- Recommendations: Document that keys are plaintext in local storage; consider warning users about security implications

**CORS/Browser API Access Header:**
- Risk: Using `anthropic-dangerous-direct-browser-access: true` header for validation
- Files: `src/services/validation.ts:74`, `src/services/ai.ts:162`
- Current mitigation: Only used for validation and generation, not for storage/sensitive ops
- Recommendations: Consider if this header usage is necessary for validation; could use different approach if possible

**External API Calls:**
- Risk: Sending component names, properties, and optionally images to external AI providers
- Files: `src/services/ai.ts:88-238`
- Current mitigation: No data persistence of responses; images optional
- Recommendations: Document data privacy implications for users dealing with proprietary components

**Figma Plugin Data Access:**
- Risk: Plugin has full access to component properties and descriptions
- Current mitigation: User controls scope (current page vs all pages) at launch
- Files: `src/main.ts:39-94`
- Recommendations: No additional concerns identified

## Performance Bottlenecks

**Concurrent Generation with Small CONCURRENCY_LIMIT:**
- Problem: `CONCURRENCY_LIMIT = 3` is hardcoded and conservative
- Files: `src/components/App.tsx:67, 375`
- Cause: Risk-averse default to avoid overwhelming external APIs
- Impact: Large documents (100+ components) take long time to process
- Improvement path: Consider making configurable, or adaptive based on API response times; test with higher limits for robustness

**Image Export Performance:**
- Problem: For each component with `includeImage: true`, plugin must export PNG from Figma (synchronous operation in main thread)
- Files: `src/main.ts:179-197`, `src/components/App.tsx:185-189`
- Impact: Blocks UI during image export; noticeable lag with 10+ components
- Improvement path: Consider batch image export if Figma API supports it; provide user feedback on what's happening

**Search Filtering on Large Documents:**
- Problem: Filtering done on every keystroke without debouncing
- Files: `src/components/App.tsx:143-155`
- Impact: Could be slow with 500+ components (unlikely in practice, but possible)
- Improvement path: Consider debouncing or memoization if performance issues emerge

## Fragile Areas

**Component State Management in App.tsx:**
- Files: `src/components/App.tsx:51-66`
- Why fragile: Multiple interrelated pieces of state (components, settings, selectedRow, iconOverrides, rowErrors, generateProgress). Side effects must maintain consistency.
- Issues:
  - `iconOverrides` and `selectedRowId` state can drift from `components` array
  - `rowErrors` not cleaned up when components unload
  - Progress state reset only at end of generate, not on cancel in all paths
- Safe modification: Any state change should verify dependent state remains consistent; add tests for state interactions
- Test coverage: None - HIGH RISK

**Concurrent Worker Queue in generateAll:**
- Files: `src/components/App.tsx:327-376`
- Why fragile: Uses mutable queue with multiple async workers sharing state
- Issues:
  - `completed` variable incremented without synchronization (same race condition as old bug but in single-threaded callback)
  - `abortGenerateAllRef` checked but could race with completion
- Safe modification: Ensure abort safety by checking flag before state updates
- Test coverage: None - MEDIUM RISK

**Icon Override Logic:**
- Files: `src/components/App.tsx:211-231`
- Why fragile: Override state uses cyclic toggle (undefined → !auto → undefined)
- Issues:
  - If component is deleted, override lingers in settings (unbounded growth)
  - Inconsistent behavior if `isIcon` property disappears from auto-detection
- Safe modification: Add cleanup for deleted components; handle missing isIcon gracefully
- Test coverage: None - LOW-MEDIUM RISK

**Figma Node ID Resolution:**
- Files: `src/main.ts:143-151, 166-177, 181-183`
- Why fragile: Uses string node IDs that become invalid if components are deleted
- Issues:
  - `figma.getNodeById()` returns null for deleted components (handled)
  - But UI still shows deleted component until refresh
  - Component selection can fail silently if component deleted between click and apply
- Safe modification: Validate node exists before operations; refresh component list on structural changes
- Test coverage: None - MEDIUM RISK

## Scaling Limits

**Component List Rendering:**
- Current capacity: Tested with ~100 components
- Limit: UI may become laggy with 500+ components (Preact rendering all items in memory)
- Scaling path: Implement virtual scrolling (window rendering) for large lists

**API Rate Limiting:**
- Current: No rate limiting implemented
- Risk: Running "Generate All" on 200+ components could trigger API rate limits
- Scaling path: Add exponential backoff retry logic; batch requests; add queue management

**Settings Storage:**
- Current: `iconOverrides` stored in Settings with unbounded size
- Risk: Over time with many components, could exceed Figma storage limits
- Scaling path: Implement cleanup for deleted components; consider storage quotas

**Image Export Memory:**
- Current: Each image exported as base64 string in memory
- Risk: 50+ large component images in memory simultaneously could cause browser issues
- Scaling path: Stream images or chunk exports; consider local caching with cleanup

## Dependencies at Risk

**Preact (^10.19.3):**
- Risk: Minor version bump could introduce breaking changes in hook behavior
- Impact: Could break state management patterns in components
- Migration plan: Pin to specific version if stability critical; test minor upgrades thoroughly

**create-figma-plugin (^3.2.0):**
- Risk: Plugin API changes in Figma could break utilities
- Impact: Event handlers, settings persistence, UI rendering could fail
- Migration plan: Monitor Figma plugin changelog; test in development environment before rolling out

**Vitest (^4.0.18):**
- Risk: Breaking changes in test runner minor versions
- Impact: Tests could fail to run or behave differently
- Migration plan: Not critical since no tests currently run in CI; can be bumped safely

## Missing Critical Features

**No Progress Indication During Image Export:**
- Problem: When "Include image" enabled with 10+ components, UI appears frozen during export phase
- Files: `src/components/App.tsx:306-381`, `src/main.ts:179-197`
- Blocks: Better UX for image-heavy workloads

**No Retry Logic for Failed API Calls:**
- Problem: Single API failure aborts entire "Generate All" operation
- Files: `src/services/ai.ts:240-264`
- Blocks: Reliable operation on unstable networks
- Note: Removed in recent simplification (see simplification/002-remove-auto-retry.md)

**No Offline Mode:**
- Problem: Plugin requires API connectivity; no graceful degradation if offline
- Blocks: Using plugin while offline

**No Description History/Undo:**
- Problem: Can only revert to previous single state, not full history
- Files: `src/components/App.tsx:263-285`
- Blocks: Ability to compare multiple AI generations or undo accidental saves

## Technical Debt Resolutions

**Migration from Old Cache System:**
- Files: `src/main.ts:135`
- Status: Cleanup code present for old cache data
- Resolution: Can be removed after sufficient time (users have upgraded)

**Removed Features (Simplification):**
- Provider fallback chain (removed - now single provider only)
- Auto-retry logic (removed - single attempt)
- Description caching (removed - stateless)
- See `specs/simplification/` for detailed context

**Type Safety:**
- `any` usage minimal; found in tests only for mocking
- `as unknown` used appropriately for type assertions
- Overall: Good type coverage
- Recommendations: Continue strict mode enforcement

## Summary of Priorities

**HIGH (Fix immediately or block feature work):**
1. Add tests for `App.tsx` - Core logic with race condition history
2. Add tests for `main.ts` - Figma integration foundation
3. Test concurrent generation edge cases thoroughly

**MEDIUM (Address in next sprint):**
1. Implement virtual scrolling for large component lists
2. Add progress feedback for image export phase
3. Clean up `iconOverrides` for deleted components
4. Add rate limiting/exponential backoff for API calls

**LOW (Nice to have):**
1. Make `CONCURRENCY_LIMIT` configurable
2. Add description history tracking
3. Implement offline stub mode

---

*Concerns audit: 2026-02-24*
