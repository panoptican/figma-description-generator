# Compact Component Rows with Expand/Collapse

## Priority
HIGH

## Description
Replace the current always-expanded component rows with compact single-line rows that expand on click. Description state should be visible at a glance without treating missing descriptions as errors.

## User Story
As a designer auditing my component descriptions, I want to see many components at once so I can quickly identify which ones need work.

## Current State
- Each row shows: large COMPONENT badge, name, 4-row textarea, Generate button
- All rows are always expanded
- Takes significant vertical space (~120px per row)
- Hard to scan quickly

## Design

### Collapsed State (default)
```
┌─────────────────────────────────────────────────────────────┐
│ Button - Primary             A bold button for prim...    → │
└─────────────────────────────────────────────────────────────┘
```

- **Component name** on left
- **Description preview** truncated to ~60 chars with ellipsis, or empty
- **Chevron** (→) or subtle expand indicator on right
- **Row height**: ~36px
- **Missing descriptions**: White/neutral background with no status dot
- **Existing descriptions**: Very light green background with a green status dot
- **Descriptions generated this session**: Very light yellow background with a yellow status dot
- **Click anywhere** on row to expand

### Expanded State (on click)
```
┌─────────────────────────────────────────────────────────────┐
│ Button - Primary                                            │
│ Component · Size=large, Variant=filled                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ A bold button for primary actions like form submits     │ │
│ │ and confirmations.                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Generated via Claude                   [Generate]  [Revert] │
└─────────────────────────────────────────────────────────────┘
```

- **Name** prominent at top
- **Type + properties** as small muted text (not a badge): "Component · Size=large, Variant=filled"
- **Textarea** 2 lines default, resizable
- **Status text** left-aligned: "Generated via Claude", "From cache", "Saving..."
- **Action buttons** right-aligned: Generate, Revert (if previous exists)
- **Collapse**: Click outside, press Escape, or click the row header area

## Acceptance Criteria
- [x] Collapsed rows are single-line, ~36px height
- [x] Component name displayed on left
- [x] Description preview (truncated) displayed if exists
- [x] Rows without descriptions have a white/neutral background and no status dot
- [x] Rows with existing descriptions have a very light green background and green status dot
- [x] Rows generated during the current plugin session have a very light yellow background and yellow status dot
- [x] Regenerating a row during the same session keeps it in the generated state
- [x] Clicking a row expands it inline
- [x] Expanded row shows type and properties as muted text (no badge)
- [x] Expanded row has 2-line textarea
- [x] Status text appears left of action buttons
- [x] Collapsed rows distinguish component sets, standalone components, and variants; variants identify their parent
- [x] Generate and Revert buttons right-aligned
- [x] Clicking outside or pressing Escape collapses the row
- [x] Only one row can be expanded at a time (optional - discuss)

## Technical Notes
- Add `expanded` state to ComponentRow or manage in parent
- Remove TYPE_COLORS and badge rendering
- Truncate description with CSS (`text-overflow: ellipsis`) or JS
- Description state is derived from the current description plus the session-local set of generated component IDs
- Consider keyboard navigation (arrow keys to move between rows)

## Design Decisions
- **Multiple rows can be expanded at once** - allows comparing descriptions side by side
- Keyboard shortcut to expand/collapse: nice to have, not required for initial implementation

## Implementation Notes
- Expanded state managed in ComponentList via `expandedRows` Set
- Collapsed rows: 36px height, name on left, truncated description preview, chevron indicator
- Missing rows: white/neutral background with no status dot
- Existing rows: very light green background with a green status dot
- Generated rows: very light yellow background with a yellow status dot
- Expanded rows: status background, name header, type/properties as muted text, 2-line textarea
- Component-set rows are labeled as parents; variant rows are indented and labeled "Variant of {parentName}"
- Escape key collapses expanded row via document keydown listener
- Removed column headers (Layer Name, Description, Actions) - not needed with new design
- Removed TYPE_COLORS badge in favor of text-based type display

## Status: COMPLETE
