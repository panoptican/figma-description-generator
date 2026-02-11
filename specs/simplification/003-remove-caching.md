# SIMP-003: Remove Description Caching System

## Priority
🟢 **Medium**

## Status
Open

## Type
Simplification / Code Removal

## Description
Remove the entire caching system that stores generated descriptions in Figma's clientStorage. Always generate fresh descriptions on demand.

## Rationale for Removal
1. **Complexity**: Cache system spans 4 files with key generation, hashing, storage
2. **Stale data**: Cached descriptions become outdated when components change visually
3. **Invalidation issues**: Cache keys don't include component appearance, only metadata
4. **Storage bloat**: Cache grows unbounded, never cleaned
5. **Marginal benefit**: API calls are cheap (<$0.01 each), caching saves pennies
6. **False hits**: Design changes without rename/property changes yield stale descriptions

## Current Behavior
- Generate description → save to cache with key: `hash(name + type + props + prompt)`
- Next generation with same key → return cached description instantly
- Cache badge shows "From cache" in UI
- Cache persists across sessions in Figma clientStorage
- "Clear cache" button to manually invalidate

## Proposed Behavior
- Generate description → call API immediately
- No caching layer
- No cache storage
- Always fresh descriptions

## Files to Remove Entirely
- `src/services/cache.ts` (119 lines) - DELETE
- `src/services/cache.test.ts` (~100 lines) - DELETE

## Files to Modify

### `src/types.ts`:
- Remove `fromCache?: boolean` from ComponentData

### `src/components/App.tsx`:
- Remove cache initialization (lines ~50-60)
- Remove `cacheHits` state
- Remove `cacheSize` state
- Remove cache loading on mount
- Remove cache saving after generation
- Remove `clearCache` handler
- Remove cache export/import logic
- Simplify `generateDescription` to just call AI service

### `src/components/ComponentRow.tsx`:
- Remove `fromCache` prop
- Remove `lastFromCache` state
- Remove cache badge display

### `src/components/Header.tsx`:
- Remove cache size display
- Remove "Clear Cache" button

### `src/main.ts`:
- Remove cache storage handlers
- Remove `LOAD_CACHE`, `SAVE_CACHE`, `CLEAR_CACHE` events

### `src/services/ai.ts`:
- Already doesn't know about cache (good separation)
- No changes needed

## Code Removal Estimate
- `cache.ts`: 119 lines
- `cache.test.ts`: ~100 lines
- `App.tsx`: ~150 lines (cache management)
- `ComponentRow.tsx`: ~20 lines
- `Header.tsx`: ~30 lines
- `main.ts`: ~40 lines
- `types.ts`: ~5 lines
- **Total: ~464 lines removed**

## Storage Impact
Before:
```
clientStorage.cache = {
  "hash123": { description: "...", timestamp: 1234567890 },
  "hash456": { description: "...", timestamp: 1234567891 },
  // ... potentially thousands of entries
}
```

After:
```
// No cache storage
```

Users regain storage space in Figma.

## Performance Implications

**Cache Hit (current):**
- Lookup: ~1ms
- Total: ~1ms
- Cost: $0.00

**API Call (proposed):**
- Network + AI: ~500-1500ms
- Total: ~1000ms average
- Cost: ~$0.001

**Analysis**: For 100 components, difference is:
- Time: +100 seconds (1.6 minutes)
- Cost: +$0.10

Trade-off is acceptable because:
1. Descriptions should be fresh
2. Users rarely regenerate unchanged components
3. "Generate All" is infrequent
4. API costs are negligible

## UX Changes

**Removed features:**
- Cache size indicator in header
- "From cache" badge on rows
- "Clear cache" button
- Export/import includes cache data

**Improved:**
- Always fresh descriptions
- No confusion about cache invalidation
- No need to clear cache when components change
- Simpler mental model

## Testing Plan
1. Remove all cache code
2. Test generation:
   - Single component → calls API
   - Generate All → calls API for each
   - Regenerate same component → calls API again (no cache)
3. Test settings:
   - No cache-related settings
   - Export/import settings works without cache
4. Verify storage:
   - No cache data in clientStorage
   - Storage cleanup (remove old cache data)

## Migration

Clean up old cache data:
```typescript
// In main.ts on plugin load
async function migrateRemoveCache() {
  await figma.clientStorage.deleteAsync('cache')
  await figma.clientStorage.deleteAsync('cacheVersion')
}
```

## Estimated Effort
5 hours (includes testing and migration)

## Dependencies
- None (can be done independently)

## Related Issues
- SIMP-001 (Remove fallbacks - cache keys use provider info)
- PERF-002 (Throttle cache saves - becomes moot)

## User Communication
Release notes:
- Caching removed for always-fresh descriptions
- Descriptions now always reflect current component state
- Slight increase in generation time (1-2s per component)
- Lower memory usage, simpler plugin

## Rollback Plan
Cache code is in git history. If needed:
1. Revert cache removal commits
2. Re-add cache files
3. Bump plugin version

## Alternative Considered: Smarter Cache Keys
Instead of removing cache, we could improve cache invalidation:
- Include component image hash in cache key
- Include last modified timestamp
- Add TTL (time-to-live) for cache entries

**Rejected because:**
- Still complex (~200 lines of improved cache logic)
- Adds image export overhead even when not using images
- Marginal improvement over current issues
- Simpler to just remove it
