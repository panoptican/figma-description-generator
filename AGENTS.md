# Repository Guidelines

## Ralph Wiggum (Autonomous Development)

This project uses the Ralph Wiggum autonomous development framework.

**Constitution:** `.specify/memory/constitution.md`

### Quick Start

```bash
# Run the autonomous loop
./scripts/ralph-loop.sh

# With iteration limit
./scripts/ralph-loop.sh 10
```

### Creating Specs

Add specifications to `specs/` as markdown files. The agent picks the highest priority incomplete spec and implements it.

---

## Project Structure & Module Organization
- `src/main.ts` wires Figma command handlers and settings persistence; UI entry sits in `src/ui.tsx`.
- UI is built from Preact components under `src/components/`; shared types live in `src/types.ts`.
- Service logic (AI calls, prompt shaping) is under `src/services/`.
- Built plugin bundles land in `build/`; `manifest.json` is the Figma entry manifest.

## Build, Test, and Development Commands
- `npm run build` — bundles the plugin with type checking and minification via `build-figma-plugin`.
- `npm run watch` — rebuilds on change with type checking; use while iterating with a Figma development plugin pointed at `manifest.json`.

## Coding Style & Naming Conventions
- TypeScript with Preact; prefer functional components and hooks-free patterns consistent with current code.
- Two-space indentation, single quotes, and trailing commas where possible; mirror existing imports grouped by library then local paths.
- Name handlers and events descriptively (e.g., `LoadComponentsHandler`, `currentPage`); keep filenames PascalCase for components and camelCase for utilities/services.
- Favor small, pure helpers over inline logic; reuse types from `src/types.ts` rather than duplicating shapes.

## Testing Guidelines
- No automated tests present; validate changes by running `npm run watch`, reloading the plugin in Figma, and exercising both “Current page” and “All pages” menu entries.
- When adding logic, prefer extracting testable helpers; if you add tests, colocate under `src/**/__tests__` and align naming with the module under test.
- Verify description application, variant parsing, and image export flows before shipping.

## Commit & Pull Request Guidelines
- Commits follow concise, imperative summaries (e.g., “Add collapsible page rows”, “Update default prompts”); keep scope focused.
- PRs should include: purpose, key changes, manual test notes (commands used, pages tested), and screenshots/GIFs when UI changes occur.
- Link to any relevant issue/ticket; mention edge cases touched (component sets, variants, API failures).

## Security & Configuration Tips
- Do not commit API keys; they are user settings stored via Figma’s settings API. If adding new providers, guard against missing secrets and prefer optional UI fields.
- Keep plugin permissions minimal; changes to `manifest.json` should be documented in the PR summary.
