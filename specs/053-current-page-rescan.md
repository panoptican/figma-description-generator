# Current-page rescan

## Priority
HIGH

## Description
Keep the Current page command aligned with the page the user is currently viewing, while retaining a manual rescan action for either scan scope.

## Acceptance Criteria

- [x] Current page mode rescans when the user changes Figma pages.
- [x] The component list updates to the newly active page.
- [x] Selection and row errors reset after a rescan.
- [x] A visible refresh action rescans the current page or all pages, depending on the command used.
- [x] All pages mode does not rescan merely because the active page changes.
- [x] Refresh is disabled while Generate All is running.

## Implementation Notes

- Main-thread `currentpagechange` handling re-emits the component list only in Current page mode.
- The Header refresh control uses the existing `LOAD_COMPONENTS` event for an explicit scan.
- The UI clears stale row selection and errors when a new component list arrives.

## Status: COMPLETE
