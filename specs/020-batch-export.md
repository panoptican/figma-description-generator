# Batch Description Export

## Priority
MEDIUM

## Description
Allow users to export all generated descriptions to a file (CSV or JSON). This enables documentation workflows outside Figma and provides backup of generated content.

## User Story
As a designer, I want to export all my component descriptions to a file so that I can use them in external documentation or share with team members who don't use Figma.

## Acceptance Criteria
- [x] "Export" button in header triggers export flow
- [x] Export includes: component name, page name, type, properties, description
- [x] Support CSV format (spreadsheet-compatible)
- [x] Support JSON format (developer-friendly)
- [x] User chooses format before export
- [x] File downloads to user's computer
- [x] Only exports components with descriptions (skip empty)
- [x] Export respects current filters (search, page selection)

## Technical Notes
- Figma plugins can trigger file downloads via data URLs
- CSV needs proper escaping for descriptions containing commas/quotes
- JSON should be pretty-printed for readability
- Consider including component ID for potential re-import
- Large exports may need chunking or streaming approach

## Implementation Notes
- Export utility in `src/utils/export.ts` with `exportDescriptions`, `toCSV`, `toJSON` functions
- Export modal in `src/components/ExportModal.tsx` for format selection
- Export button added to Header with disabled state when no descriptions exist
- CSV properly escapes commas, quotes, and newlines per RFC 4180
- JSON is pretty-printed with 2-space indentation
- Component ID included in export for potential re-import workflows
- Tests in `src/utils/export.test.ts` (29 tests)

## Status: COMPLETE
