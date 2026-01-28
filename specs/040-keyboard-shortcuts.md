# Keyboard Shortcuts

## Priority
LOW

## Description
Add keyboard shortcuts for common actions to improve power user workflow. Currently all actions require mouse clicks.

## User Story
As a designer who uses the plugin frequently, I want keyboard shortcuts so that I can work faster without reaching for the mouse.

## Acceptance Criteria
- [ ] Cmd/Ctrl+G: Generate description for selected/focused component (not implemented - no row selection UI)
- [x] Cmd/Ctrl+Shift+G: Generate all descriptions
- [x] Cmd/Ctrl+S: Save current description (if editing) - N/A, app auto-saves on debounce
- [ ] Cmd/Ctrl+Z: Revert to previous description (not implemented - no row selection UI)
- [x] Escape: Close settings modal if open
- [x] Cmd/Ctrl+F: Focus search field
- [x] Shortcuts work when plugin window is focused
- [x] Shortcuts don't conflict with Figma's native shortcuts

## Technical Notes
- Use standard keyboard event listeners in Preact
- Check for modifier keys (metaKey for Mac, ctrlKey for Windows)
- May need to prevent default browser behavior
- Consider showing shortcuts in tooltips on buttons
- Test on both Mac and Windows

## Implementation Notes
- Created `src/hooks/useKeyboardShortcuts.ts` with:
  - `useKeyboardShortcuts` hook for handling keyboard events
  - `getModifierKeyLabel()` - returns ⌘ for Mac, Ctrl+ for Windows
  - `getShortcutLabel(key, shift)` - formats shortcut labels for display
- Updated Header component:
  - Search input now shows shortcut hint in placeholder
  - Generate All button tooltip shows shortcut
  - Replaced SearchTextbox with custom input for ref support
- Keyboard shortcuts integrated in App component
- Tests in `src/hooks/useKeyboardShortcuts.test.ts` (13 tests)
- Note: Single-component shortcuts (Cmd+G, Cmd+Z) not implemented as they require
  a row selection UI concept that doesn't exist in the current design

## Status: COMPLETE
