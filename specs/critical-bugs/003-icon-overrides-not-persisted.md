# BUG-003: Icon Overrides Not Persisted

## Priority
🟡 **High**

## Status
Open

## Description
When users manually toggle icon mode for specific components using the "Icon" button, these overrides are stored in component state but not persisted to settings. Closing and reopening the plugin loses all manual icon mode selections.

## Location
`src/components/App.tsx:74`

```typescript
const [iconOverrides, setIconOverrides] = useState<Record<string, boolean>>({})
```

## Impact
- **Poor UX**: Users must re-toggle icon mode every session
- **Lost work**: Manual classifications don't persist
- **Inconsistency**: Auto-detected icons persist, manual overrides don't

## Reproduction Steps
1. Open plugin with document containing "Button" component (not auto-detected as icon)
2. Expand the Button row
3. Click "Icon" button to enable icon mode
4. Generate description (should use icon prompt)
5. Close plugin
6. Reopen plugin
7. Expand Button row
8. Observe: Icon mode is OFF (override lost)

## Root Cause
`iconOverrides` state is initialized empty on every plugin launch and never saved to Figma's storage. Only auto-detection runs fresh each time.

## Proposed Fix

1. Add `iconOverrides` to Settings interface in `types.ts`:
```typescript
export interface Settings {
  // ... existing fields
  iconOverrides?: Record<string, boolean>  // componentId -> isIcon override
}
```

2. Load overrides from settings in `App.tsx`:
```typescript
useEffect(() => {
  if (settings.iconOverrides) {
    setIconOverrides(settings.iconOverrides)
  }
}, [settings])
```

3. Save overrides when changed:
```typescript
const handleToggleIcon = useCallback((id: string) => {
  setIconOverrides(prev => {
    const newOverrides = { ...prev, [id]: !prev[id] }

    // Save to settings
    const newSettings = { ...settings, iconOverrides: newOverrides }
    emit<SaveSettingsHandler>('SAVE_SETTINGS', newSettings)

    return newOverrides
  })
}, [settings])
```

4. Consider adding cleanup for deleted components (optional):
   - When component no longer exists, remove from `iconOverrides`
   - Prevents unbounded growth of override storage

## Testing
1. Open plugin
2. Toggle icon mode on 3 components
3. Close plugin
4. Reopen plugin
5. Verify all 3 components still have icon mode enabled
6. Generate descriptions and verify icon prompt is used

## Estimated Effort
2 hours

## Dependencies
None

## Related Issues
None

## Notes
Alternative approach: Store overrides in component-level plugin data using `setPluginData()`, but this requires main thread access and is more complex. Settings storage is simpler and more consistent with current architecture.
