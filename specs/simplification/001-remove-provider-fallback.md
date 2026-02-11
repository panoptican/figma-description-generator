# SIMP-001: Remove Provider Fallback Chain

## Priority
🟢 **Medium**

## Status
Open

## Type
Simplification / Code Removal

## Description
Remove the automatic provider fallback chain feature. Currently, if one provider fails, the system automatically tries the next provider in the priority list. This adds significant complexity for questionable benefit.

## Rationale for Removal
1. **Complexity**: Fallback logic spans multiple files (App.tsx, fallback.ts, ai.ts)
2. **Rare usage**: Provider failures are uncommon in normal operation
3. **Confusing UX**: Users don't know which provider generated which description
4. **Debugging difficulty**: Harder to diagnose provider-specific issues
5. **API cost unpredictability**: Falls back to more expensive providers automatically

## Current Behavior
- User configures primary provider (e.g., ChatGPT)
- User optionally configures fallback providers
- On failure, system tries next provider automatically
- UI shows which provider was actually used

## Proposed Behavior
- User selects ONE provider
- On failure, show error to user
- User can manually retry or fix API key
- Simpler, more predictable

## Files to Modify

### Remove entirely:
- `src/services/fallback.ts` (163 lines) - DELETE

### Modify:
- `src/types.ts`:
  - Remove `fallbackProviders: AIProvider[]` from Settings
  - Remove `usedProvider` from ComponentData

- `src/components/App.tsx`:
  - Remove `usedProvider` state (line 73)
  - Remove fallback logic from `generateDescription` (lines 200-250)
  - Simplify to single provider call
  - Remove `usedProvider` prop passing

- `src/components/ComponentRow.tsx`:
  - Remove `usedProvider` prop
  - Remove `lastUsedProvider` state
  - Remove provider badge display

- `src/components/SettingsModal.tsx`:
  - Remove "Fallback Providers" section
  - Remove multi-select provider UI
  - Keep single provider dropdown

- `src/main.ts`:
  - Remove fallback-related settings handling

### Tests to remove:
- `src/services/fallback.test.ts` - DELETE

## Migration
Settings migration needed for users with existing fallback configurations:

```typescript
// In settings loader
if (settings.fallbackProviders) {
  // Keep only primary provider, discard fallbacks
  delete settings.fallbackProviders
}
```

## Impact Assessment
- **Code reduction**: ~300 lines removed
- **Complexity reduction**: Eliminates multi-provider state management
- **UX simplification**: Users pick one provider, understand what's used
- **Breaking change**: Users relying on fallbacks need to reconfigure

## Testing Plan
1. Remove fallback code
2. Test single provider flows:
   - ChatGPT only
   - Claude only
   - Gemini only
3. Test error handling with invalid API keys
4. Test "Generate All" with single provider
5. Verify settings migration removes old fallback configs

## Estimated Effort
4 hours

## Dependencies
- Should be done BEFORE removing auto-retry (SIMP-002) for cleaner diff

## Related Issues
- SIMP-002 (Remove auto-retry - related simplification)
- SIMP-003 (Remove caching - uses provider info in keys)

## Rollback Plan
If needed, fallback code is in git history. Can be restored by reverting specific commits.

## User Communication
Release notes should explain:
- Fallback chain removed for simplicity
- Users should ensure their primary provider API key is valid
- Can manually switch providers if one fails
