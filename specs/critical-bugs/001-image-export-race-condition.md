# BUG-001: Image Export Race Condition

## Priority
🔴 **Critical**

## Status
Open

## Description
The image export system uses a single ref to store promise resolvers, causing race conditions when multiple components request image exports concurrently. The second request overwrites the first resolver, causing the first promise to never resolve.

## Location
`src/components/App.tsx:84-89`

```typescript
const exportComponentImage = useCallback((componentId: string): Promise<string | null> => {
  return new Promise((resolve) => {
    imageExportResolveRef.current = resolve  // BUG: Overwrites previous resolvers
    emit<ExportImageHandler>('EXPORT_IMAGE', { id: componentId })
  })
}, [])
```

## Impact
- **Memory leaks**: Unresolved promises remain in memory
- **Hung operations**: Components waiting for images never complete
- **Silent failures**: No error thrown, operation just hangs

## Reproduction Steps
1. Load plugin with "Current page" containing 10+ components
2. Enable "Include image" in settings
3. Click "Generate All"
4. Observe that only the last 3 concurrent requests complete, others hang

## Root Cause
Single `imageExportResolveRef` shared across all concurrent image export requests. When a new export starts before the previous completes, the old resolver is lost.

## Proposed Fix

Replace single ref with a Map of resolvers keyed by component ID:

```typescript
const imageExportResolvers = useRef<Map<string, (value: string | null) => void>>(new Map())

const exportComponentImage = useCallback((componentId: string): Promise<string | null> => {
  return new Promise((resolve) => {
    imageExportResolvers.current.set(componentId, resolve)
    emit<ExportImageHandler>('EXPORT_IMAGE', { id: componentId })
  })
}, [])

// In the handler:
on<ImageExportedHandler>('IMAGE_EXPORTED', ({ id, imageData }) => {
  const resolve = imageExportResolvers.current.get(id)
  if (resolve) {
    resolve(imageData)
    imageExportResolvers.current.delete(id)
  }
})
```

## Testing
1. Load document with 50 components
2. Enable image inclusion
3. Run "Generate All"
4. Verify all image exports complete successfully
5. Check browser memory for leaks (DevTools Memory profiler)

## Estimated Effort
2 hours

## Dependencies
None

## Related Issues
- BUG-002 (concurrent generation race - different issue but similar pattern)
