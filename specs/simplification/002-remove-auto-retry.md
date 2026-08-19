# SIMP-002: Remove Automatic Retry Logic

## Priority
🟢 **Medium**

## Status: COMPLETE

## Type
Simplification / Code Removal

## Description
Remove the automatic retry mechanism with exponential backoff. Currently, failed API calls are retried up to 3 times with increasing delays. Users should manually retry if needed.

## Rationale for Removal
1. **Complexity**: Retry logic adds ~200 lines across multiple files
2. **Unpredictable timing**: Users don't know how long operations will take
3. **Hidden failures**: Multiple retries mask underlying issues
4. **API cost**: Automatic retries multiply costs on persistent failures
5. **Rare benefit**: Most failures are permanent (bad API key, quota exceeded)

## Current Behavior
- On API failure, automatically retry up to 3 times
- Exponential backoff: 1s, 2s, 4s delays
- UI shows "Retrying... attempt 2/3" with cancel button
- Distinguishes retryable (429, 500) vs non-retryable (401, 400) errors

## Proposed Behavior
- On API failure, show error immediately
- User manually clicks "Generate" to retry
- Simpler, more transparent
- Faster feedback on permanent failures

## Files to Modify

### Modify:
- `src/services/ai.ts`:
  - Remove `RetryStrategy` class
  - Remove `retryWithBackoff` function
  - Remove retry loop from `generateDescription`
  - Simplify to single try-catch

- `src/types.ts`:
  - Remove `retryStatus` from ComponentData

- `src/components/App.tsx`:
  - Remove `retryStatus` state (line 72)
  - Remove retry management in `generateDescription`
  - Remove `cancelRetry` handler
  - Remove retry progress tracking

- `src/components/ComponentRow.tsx`:
  - Remove `retryStatus` prop and display
  - Remove `onCancelRetry` prop
  - Remove retry status UI (lines 367-397)

### Tests to modify:
- `src/services/ai.test.ts`:
  - Remove retry-specific tests
  - Keep basic error handling tests

## Code Removal Estimate
- `ai.ts`: ~80 lines
- `App.tsx`: ~50 lines
- `ComponentRow.tsx`: ~30 lines
- `types.ts`: ~10 lines
- Tests: ~100 lines
- **Total: ~270 lines removed**

## Error Handling Changes

**Before:**
```typescript
try {
  return await retryWithBackoff(
    () => callProvider(...),
    new RetryStrategy(3, 1000)
  )
} catch (error) {
  // Only reached after 3 retries
}
```

**After:**
```typescript
try {
  return await callProvider(...)
} catch (error) {
  // Immediate failure
  throw new Error(`Failed to generate: ${error.message}`)
}
```

## Impact Assessment
- **Code reduction**: ~270 lines removed
- **Complexity reduction**: No retry state management
- **UX change**: Faster feedback, requires manual retry
- **API efficiency**: Fewer wasted calls on permanent failures

## User Experience Changes

**Before:**
- Click "Generate All" with bad API key
- Each component retries 3 times (3-4 seconds each)
- 100 components × 3 retries = 300 API calls
- Takes 5+ minutes to fail completely

**After:**
- Click "Generate All" with bad API key
- Each component fails immediately (~200ms)
- 100 components × 1 call = 100 API calls
- Fails in 20 seconds, clear error message

**Winner:** After (faster, clearer feedback)

## Testing Plan
1. Remove retry code
2. Test immediate failure modes:
   - Invalid API key → instant error
   - Rate limit → show 429 error
   - Network issue → show network error
3. Test manual retry:
   - Fix API key
   - Click "Generate" → success
4. Test "Generate All":
   - Verify single attempt per component
   - Verify errors show immediately

## Estimated Effort
3 hours

## Dependencies
- Should be done AFTER SIMP-001 (remove fallbacks) for cleaner code

## Related Issues
- SIMP-001 (Remove fallbacks - related simplification)
- UX-002 (Add retry button to rows with errors)

## User Communication
Release notes:
- Automatic retry removed for faster feedback
- Failed generations now show errors immediately
- Click "Generate" button again to manually retry
- Tip: Check API key if all generations fail instantly

## Migration Notes
No settings migration needed - retry was not configurable by users.

## Implementation Notes
Provider calls fail immediately and the row-level Generate action provides the manual retry path. Verify the user-visible error and retry flow in Figma before publishing.
