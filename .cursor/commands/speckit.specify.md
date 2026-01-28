# SpecKit Specify Command

Generate a specification file for a new feature.

## Usage

`/speckit.specify [feature description]`

## Template

When the user runs this command, create a spec file in `specs/` using this format:

```markdown
# [Feature Name]

## Priority
[HIGH/MEDIUM/LOW]

## Description
[Clear description of what this feature does]

## User Story
As a [user type], I want to [action] so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
[Any implementation details, constraints, or considerations]

## Status: INCOMPLETE
```

## Naming Convention

Name spec files with priority prefix:
- `001-critical-feature.md`
- `010-important-feature.md`
- `100-nice-to-have.md`

Lower numbers = higher priority.
