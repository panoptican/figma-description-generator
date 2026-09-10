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
│ Button - Primary             A bold button for prim...    ✓ │
└─────────────────────────────────────────────────────────────┘
```

- **Component name** on left
- **Description preview** truncated to ~60 chars with ellipsis, or empty
- **Direct controls**: A compact blue Icon button only when the naming rule enables icon mode; clicking turns it off. No overflow, info button, or separate row chevron
- **Row height**: 40px, with full-width horizontal dividers between rows; expanded rows use 16px padding
- **Missing descriptions**: Neutral background and a "No description" preview
- **Existing and generated descriptions**: Same neutral background, with a trailing checkmark and a tooltip explaining the status
- **Focus**: No persistent selected-row marker or selection state. Keyboard focus belongs to the actual row controls and editor
- **Click anywhere** on row to expand

### Expanded State (on click)
```
┌─────────────────────────────────────────────────────────────┐
│ Button - Primary                                            │
│ Component set                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ A bold button for primary actions like form submits     │ │
│ │ and confirmations.                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                        [Generate]  [Revert] │
└─────────────────────────────────────────────────────────────┘
```

- **Name** prominent at top
- **Component set** as a small muted label beside set names; no repeated variant metadata or property inventories
- **Textarea** 2 lines default, resizable
- **Feedback** appears only for temporary activity, unsaved changes, and errors
- **Action buttons** right-aligned: Generate, Revert (if previous exists). Sets with visible variants use a joined “Generate one | Set + variants” control
- **Collapse**: Press Escape while focus is in this row, or click its header/toggle

### Approved row refinements (2026-09-04)

- Remove the permanent Source, Provider, and Status footer. Keep row-local saving, unsaved, and generation feedback plus existing errors; a global batch must not label unrelated rows as generating.
- Remove the property inventory and Details disclosure. Properties remain available in Figma and continue to inform generation and search.
- Keep the small “Component set” label beside a set name. Nested variants use the surrounding Variants context instead of repeating “Variant of …”. Parent navigation and its scroll/ref plumbing are removed.
- Detect icon mode from the whole word “icon” or “icons” anywhere in the component or page name. Variants retain their parent set’s detection. Only active icons show a blue Icon button that turns the mode off and disappears; the opt-out persists. There is no manual-on control, and legacy true overrides cannot enable mode without a matching name.
- The title/header is the keyboard-accessible expand/collapse target; the conditional Icon button is a sibling control and does not toggle the row. Remove the separate right-pointing chevron.

- Join the two set-generation actions into one blue control with two separately focusable buttons. “Generate one” updates only the set description; “Set + variants” updates the set and all its variants. Both remain direct actions and replace existing descriptions as before. Disable both while either action is busy, and show loading only on the active half without changing its width. Revert stays separate. Standalone components and sets with hidden or no variants retain their single Generate description button.

## Acceptance Criteria
- [x] Collapsed rows are single-line, 40px height
- [x] Component name displayed on left
- [x] Description preview (truncated) displayed if exists
- [x] All rows use neutral surfaces in both themes, with no green, yellow, or blue state fills
- [x] Described rows show a neutral checkmark with an existing/generated status tooltip
- [x] No persistent selection marker; row commands follow actual keyboard focus
- [x] Component sets and their variants share one group, with variant content inset by 40px and a Variants heading; no tree rails or branches
- [x] Dividers span the full list width while variant content remains indented
- [x] Description fields use a distinct surface, stronger border, readable placeholder, and visible focus treatment
- [x] Search results retain the set name and nested container when only variants match
- [x] Each Variants label is a keyboard-accessible disclosure that independently folds its list, preserving drafts and individual row expansion states
- [x] Regenerating a row during the same session keeps it in the generated state
- [x] Clicking a row expands it inline
- [x] Expanded row keeps “Component set” context beside set names, without a property inventory or Details disclosure
- [x] Expanded row has 2-line textarea
- [x] Transient saving, unsaved, local generation, and error feedback appears without permanent provider/source/status metadata
- [x] Collapsed rows label component sets; nested variants use the surrounding set context without repeating their parent name
- [x] Generate and Revert buttons right-aligned
- [x] Eligible component sets use a joined generation control with distinct single and group actions
- [x] Pressing Escape collapses only the focused row. Clicking or keyboard-activating its header also toggles the row
- [x] Cmd/Ctrl+G generates only the focused row, including an individual variant; Cmd/Ctrl+Z reverts that row outside text editors and leaves native text undo intact
- [x] Multiple rows can be expanded at once

## Technical Notes
- Add `expanded` state to ComponentRow or manage in parent
- Remove TYPE_COLORS and badge rendering
- Truncate description with CSS (`text-overflow: ellipsis`) or JS
- Description state is derived from the current description plus the session-local set of generated component IDs
- Consider keyboard navigation (arrow keys to move between rows)

## Design Decisions
- **Multiple rows can be expanded at once** - allows comparing descriptions side by side
- Tab reaches each row's header, conditional Icon button, and editor; Enter/Space activate the header and Escape collapses the focused row

## Implementation Notes
- Expanded state managed in ComponentList via `expandedRows` Set
- Collapsed rows: 40px height, name on left, truncated description preview, status checkmark, and the conditional Icon button
- Every row has a neutral surface; described status uses a checkmark tooltip when collapsed. Expanded rows show only temporary activity, unsaved changes, and errors
- Expanded rows: name with a plain component-set label where applicable, the conditional Icon button, and 2-line textarea on a distinct surface. Property inventories and Details are removed; nested variants omit repeated parent and property text
- Separate components use simple dividers and expanded padding rather than cards; component sets contain their child variants inside the same group
- Variant rows span the full list width. Their content has 56px left padding (40px beyond top-level content), with editors and actions sharing the regular right edge. The Variants label is inset to align with the child content
- The Variants disclosure has a chevron, `aria-expanded`, and `aria-controls`; its panel stays mounted while hidden to preserve edits, and hidden rows ignore Escape
- Page-level Expand All and Collapse All also open and close that page's variant groups
- `groupComponentRows` uses parent IDs so identically named sets stay separate, and retains parent-name context for variant-only search results without changing the search or generation inputs
- Row styles import the shared `ui.css` as a CSS module; boundaries derive from Figma theme tokens
- Row-level key handlers replace the remembered last-clicked target and per-row document listeners. Generation uses the existing single-row handler even for variants. Hidden rows and open settings suppress row commands; expanding/collapsing preserves useful header focus
- Click-outside handler removed to allow multiple expanded rows side by side and prevent hijacking header and modal clicks
- Removed column headers (Layer Name, Description, Actions) - not needed with new design
- Removed TYPE_COLORS badge in favor of text-based type display
- Overflow menu state, positioning, dismissal listeners, menu roles, and parent navigation are removed
- Verification for this update: 55 targeted tests pass across row controls, shortcuts, icon detection/mode resolution, and plugin handlers. Production typecheck/build passes. Tests include opt-outs, legacy manual-on settings, and preserving header focus when the Icon button disappears. Live Figma visual and keyboard checks remain pending

- Joined-control verification: 40 targeted row-action and generation-batch tests pass; production typecheck/build passes. Tests cover the two action scopes, shared unavailable state, and the single-button fallback when variants are hidden or absent. Live Figma visual inspection remains pending.

## Status: COMPLETE
