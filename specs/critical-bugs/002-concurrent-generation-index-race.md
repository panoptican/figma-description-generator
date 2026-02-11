# BUG-002: Concurrent Generation Index Race Condition

## Priority
🔴 **Critical**

## Status
Open

## Description
The "Generate All" worker system uses a shared `currentIndex` variable without proper synchronization, leading to race conditions where multiple workers may process the same component or skip components entirely.

## Location
`src/components/App.tsx:463`

```typescript
const runWorker = async () => {
  while (!abortGenerateAllRef.current) {
    const index = currentIndex++  // Not atomic! Race condition
    const component = componentsToGenerate[index]
```

## Impact
- **Duplicate work**: Same component processed by multiple workers
- **Skipped components**: Some components never get processed
- **Incorrect progress**: Progress bar shows wrong completion state
- **API waste**: Duplicate API calls cost money

## Reproduction Steps
1. Load document with 100+ components
2. Click "Generate All"
3. Monitor network requests for duplicates
4. Check if all components received descriptions (some may be skipped)

## Root Cause
JavaScript's `++` operator is not atomic. When multiple async workers execute `currentIndex++` simultaneously:
- Worker A reads `currentIndex` (value: 5)
- Worker B reads `currentIndex` (value: 5)  ← same value
- Worker A increments to 6
- Worker B increments to 6  ← overwrites A's increment
- Both workers process index 5, index 6 is skipped

## Proposed Fix

**Option 1: Queue-based approach (recommended)**
```typescript
const queue = [...componentsToGenerate]

const runWorker = async () => {
  while (!abortGenerateAllRef.current) {
    const component = queue.shift()  // Atomic array operation
    if (!component) break

    // Process component...
  }
}
```

**Option 2: Synchronized index increment**
```typescript
const getNextIndex = (() => {
  let current = 0
  return () => {
    const next = current
    current++
    return next
  }
})()

const runWorker = async () => {
  while (!abortGenerateAllRef.current) {
    const index = getNextIndex()
    // ...
  }
}
```

## Testing
1. Load document with 200 components
2. Add console logs to track which worker processes which component
3. Run "Generate All"
4. Verify:
   - No component processed twice
   - All components processed exactly once
   - Progress reaches 100%

## Estimated Effort
3 hours (including testing)

## Dependencies
None

## Related Issues
- BUG-001 (similar concurrency pattern)

## Notes
This bug is subtle and may not manifest obviously in small documents (<20 components). Most likely to occur with 50+ components and high concurrency.
