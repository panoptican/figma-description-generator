# Project Constitution

## Project Identity

**Name:** Description Generator
**Vision:** AI-powered Figma plugin that generates descriptions for components and component sets using LLM providers. Helps designers document their design systems automatically.

## Ralph Wiggum

**Version:** b97a1638185dd25501b26ba128d4798b9ae999bd
**Repository:** https://github.com/fstandhartinger/ralph-wiggum

## Core Principles

1. **User experience first** - Prioritize designer workflow and ease of use
2. **Quality descriptions** - AI output should be accurate and useful

## Technical Stack

- **Framework:** Preact + TypeScript
- **Build:** create-figma-plugin toolchain
- **Target:** Figma Plugin API

## Autonomy Settings

- **YOLO Mode:** ENABLED - Agent runs without permission prompts
- **Git Autonomy:** ENABLED - Auto-commit and push after each completed task

## Work Item Discovery

The agent discovers work from these sources (in priority order):

1. `specs/` folder - Markdown files not marked `## Status: COMPLETE`
2. `IMPLEMENTATION_PLAN.md` - Unchecked `- [ ]` tasks (if exists)
3. GitHub Issues - Open issues (if connected)

## Running the Loop

```bash
# Build mode (default) - implement specs continuously
./scripts/ralph-loop.sh

# With iteration limit
./scripts/ralph-loop.sh 10

# Planning mode (optional) - generate implementation plan first
./scripts/ralph-loop.sh plan
```

## Completion Signal

The agent outputs `<promise>DONE</promise>` only when:
- Implementation matches all requirements
- All tests pass
- All acceptance criteria verified
- Changes committed and pushed
- Spec marked as complete
