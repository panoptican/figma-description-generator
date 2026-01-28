# Simplified Header

## Priority
HIGH

## Description
Reduce the header to a single row with only essential elements. Remove all helper text, scattered stats, and visual clutter.

## User Story
As a designer, I want a minimal header so that more screen space is devoted to the component list where I do my actual work.

## Current State
- Redundant "Description Generator" title
- Stats scattered horizontally ("469 components • 468 missing")
- Helper text ("Generate All respects search and filters", "Uses visible components...")
- Cache info awkwardly placed below search
- Two-row layout with search on left, Generate All on right

## Design

```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Search components...]    [Generate All (12)]  [↓]  [⚙] │
└─────────────────────────────────────────────────────────────┘
```

### Elements (left to right)
1. **Search input** - Flex-grow, placeholder "Search components..."
2. **Generate All button** - Shows count in parentheses, e.g., "Generate All (12)"
3. **Export icon** (↓) - Download/export icon, opens export modal
4. **Settings icon** (⚙) - Gear icon, opens settings modal

### Removed
- "Description Generator" title (redundant with window chrome)
- Component count stat
- Missing count stat
- "Generate All respects search and filters" helper text
- "Uses visible components in the list" helper text
- Cache size indicator and "Clear cache" button (move to settings if needed)

## Acceptance Criteria
- [x] Header is a single row
- [x] Search input on left takes available space
- [x] Generate All button shows count of components to generate
- [x] Export icon button next to Generate All
- [x] Settings icon on far right
- [x] No helper text anywhere in header
- [x] No stats displayed in header
- [x] Total header height under 50px

## Technical Notes
- Simplify Header.tsx props - remove unused stats
- Generate count is the only number shown (inside button)
- Export and Settings are icon-only buttons (no text labels)

## Implementation Notes
- Header reduced from ~90 lines of UI to ~48px single-row layout
- Removed props: `onClearCacheClick`, `totalCount`, `missingCount`, `cacheSize`, `scope`, `currentPageName`
- Search input uses `flex: 1` to fill available space
- Icon buttons are 32x32px with rounded corners
- Cancel button shows progress during generation: "Cancel (x/y)"

## Status: COMPLETE
