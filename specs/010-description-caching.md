# Description Caching

## Priority
MEDIUM

## Description
Cache generated descriptions to avoid re-generating identical components. When a component hasn't changed (same name, properties, and optionally image hash), reuse the previously generated description instead of making another API call.

## User Story
As a designer, I want the plugin to remember descriptions it already generated so that I don't waste API credits regenerating the same components.

## Acceptance Criteria
- [x] Cache stores generated descriptions keyed by component identity (name + properties hash)
- [x] Cache is checked before making AI API calls
- [x] Cache hit skips API call and uses stored description
- [x] Cache can be cleared manually via UI button
- [x] "Generate All" respects cache (only generates for uncached/changed components)
- [x] Visual indicator shows when description came from cache vs fresh generation

## Technical Notes
- Cache could use Figma's clientStorage API for persistence
- Hash component properties to detect changes
- Consider cache invalidation strategy (TTL or manual clear only)
- Image inclusion complicates caching (image changes = new generation needed)
- Could store cache per-document to avoid cross-document confusion

## Implementation Notes
- Cache key includes: component name, type, properties (sorted), parent name, prompt hash, and image hash
- Prompt hash changes invalidate cache (custom prompt changes = regenerate)
- `overwriteExisting` setting bypasses cache to force regeneration
- Cache is stored per-document using Figma's clientStorage API
- "Clear cache" button appears in header when cache has entries
- "From cache" / "Generated" indicator shows source of last generation

## Open Questions (Resolved)
- Should cache persist across plugin sessions? **Yes, via clientStorage**
- How to handle prompt changes (invalidate all cache)? **Prompt hash is part of cache key**
- Should overwriteExisting setting bypass cache? **Yes, it does**

## Status: COMPLETE
