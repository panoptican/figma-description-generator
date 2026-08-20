# Variant Set Context and Parent Generation

## Priority
HIGH

## Description
Give component-set parents and individual variants the complete sibling-variant context needed to describe scales and relationships accurately. Add a component-set action that generates the parent and every variant together.

## Acceptance Criteria

- [x] Component-set and variant prompts include every variant name and parsed property value in the set
- [x] Variant prompts include the parent name and complete sibling context when generated as part of a set
- [x] Component-set rows offer separate actions for generating the parent only and generating the parent plus all variants
- [x] Generating the whole set includes variants even when the variant display filter is disabled
- [x] Individual variant rows do not offer isolated AI generation
- [x] Generate All treats each component set as one grouped job while retaining the missing/overwrite setting
- [x] A failed member does not prevent the remaining set members from being attempted
- [x] Successful members update the canvas and local state immediately

## Implementation Notes

- `ComponentData.variantContext` stores the complete set context for parents and variants
- `ComponentData.parentId` identifies the component set for grouped generation
- Prompt context is appended automatically after the configured prompt, so existing custom prompts remain compatible
- The grouped action processes the parent first, then each variant sequentially so each request has the same complete context
- The show/hide variants setting affects list visibility; it does not split a component set into isolated generation jobs

## Status

COMPLETE
