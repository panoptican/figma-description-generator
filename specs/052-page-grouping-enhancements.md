# Page Grouping Enhancements

## Priority
HIGH

## Description
Enhance page grouping with completion counts and an "Expand All" action to expand all component rows within a page for bulk review.

## User Story
As a designer, I want to work through my document page by page, expanding all components in a section to review and edit them efficiently.

## Current State
- Pages are collapsible groups
- Show component count in parentheses
- No indication of completion status
- No bulk expand action

## Design

### Page Header Row
```
┌─────────────────────────────────────────────────────────────┐
│ ▼ Page: Buttons                        (3/8)  [Expand All] │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│ ▶ Page: Cards                          (0/12) [Expand All] │  ← collapsed
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│ ▼ Page: Forms                          (5/5)          ✓    │  ← all complete
└─────────────────────────────────────────────────────────────┘
```

### Elements
1. **Collapse/expand triangle** (▼/▶) - toggles visibility of components
2. **Page name** - "Page: {name}"
3. **Completion count** - "(3/8)" meaning 3 of 8 have descriptions
4. **Expand All button** - Expands all component rows in this page
5. **Checkmark** (✓) - Shown instead of button when all components complete

### Behavior
- **Click triangle or page name**: Toggle page collapsed/expanded (show/hide component list)
- **Click "Expand All"**: Expand all component rows within this page for editing
- **"Collapse All"**: Button changes to "Collapse All" when components are expanded

### Visual Treatment
- Pages with gaps (incomplete) could have subtle background treatment
- Completion count uses color: red/amber if gaps, green if complete
- "Expand All" button is subtle/secondary style

## Acceptance Criteria
- [x] Page header shows completion count as "(done/total)"
- [x] Count is color-coded: amber/red if incomplete, green if complete
- [x] "Expand All" button appears on page header
- [x] Clicking "Expand All" expands all component rows in that page
- [x] Button changes to "Collapse All" when components are expanded
- [x] Pages with 100% completion show checkmark instead of button
- [x] Clicking page name or triangle toggles component list visibility

## Technical Notes
- Track expanded state per-page in ComponentList or App
- Completion count: filter components with `currentDescription`
- "Expand All" sets all component IDs in that page to expanded
- Consider performance with many components (virtualization may help later)

## Implementation Notes
- Expanded state tracked via `expandedRows` Set in ComponentList
- `handleExpandAllInPage` adds all component IDs from a page to the Set
- `handleCollapseAllInPage` removes all component IDs from a page
- Button text toggles based on `allRowsExpanded` boolean
- Expand All button hidden when page is collapsed (isCollapsed)
- Checkmark shown for 100% complete pages, button shown otherwise

## Status: COMPLETE
