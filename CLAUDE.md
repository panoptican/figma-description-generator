# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered Figma plugin that generates descriptions for components and component sets. Generation runs through a publisher-managed Cloudflare Worker that calls Gemini 3.5 Flash-Lite; users never supply an API key. Helps designers document their design systems automatically.

## Development Commands

```bash
npm run build          # Build plugin with type checking and minification
npm run watch          # Watch mode for development
npm test               # Vitest for the plugin and the Worker
npm run worker:dev     # Run the generation service locally (needs worker/.dev.vars)
npm run worker:deploy  # Deploy the generation service
```

## Tech Stack

- **Framework:** Preact + TypeScript
- **Build:** create-figma-plugin 4.0.3 toolchain
- **Target:** Figma Plugin API
- **Service:** Cloudflare Worker (wrangler) in `worker/`, forwarding to the Gemini API

## Architecture

```
src/
├── main.ts          # Plugin entry - command handlers, Figma API interactions
├── ui.tsx           # UI entry point
├── types.ts         # Shared TypeScript types and event handlers
├── components/      # Preact UI components
└── services/ai.ts   # Prompt building and the generation service client
worker/
├── wrangler.jsonc   # Worker config, D1, limits, and per-IP rate limit
├── schema.sql       # D1 users and token-cache tables
└── src/             # Identity, quota, Gemini adapter, routing, and SQLite test adapter
build/               # Generated plugin bundle (git-ignored)
```

### Key Patterns

- **Event-based communication:** Uses `emit`/`on` from create-figma-plugin for main↔UI messaging
- **Settings persistence:** Uses Figma's `loadSettingsAsync`/`saveSettingsAsync` for preferences; the loader strips and purges legacy provider/API-key fields
- **Scope modes:** "This page" vs "Entire file" - determined at plugin launch
- **Payments and usage:** The manifest requests the `payments` permission. The main thread obtains Figma payment tokens and the Worker verifies them against Figma before reading or reserving D1 quota.
- **Service endpoints:** `GENERATION_ENDPOINT` in `src/services/ai.ts` must match `networkAccess.allowedDomains` in `package.json`; `/usage` is derived from that endpoint. A test enforces the origin. The Figma-assigned plugin ID also lives in `package.json` so the generated `manifest.json` keeps it.

## Plugin Menu

- **This page:** Process components on the active page only
- **Entire file:** Process all components across the document

## Component Types Handled

| Type | Description |
|:-----|:------------|
| COMPONENT | Standalone component |
| COMPONENT_SET | Container for variants |
| VARIANT | Individual variant within a component set |

## Settings

Settings are stored per-user in Figma and include:
- `customPrompt`: Custom prompt for component descriptions
- `customVariantPrompt`: Custom prompt for variant descriptions
- `customIconPrompt`: Custom prompt for icon naming
- `includeImage`: Whether to send component image to the service
- `showVariants`: Display variant rows in UI
- `overwriteExisting`: Replace existing descriptions
- `iconOverrides`: Per-component icon mode overrides
- Usage is tracked by the publisher-managed Worker per Figma user: free is lifetime-capped and Pro is monthly-capped.

## Testing

Run the automated suite and build before manual Figma validation:

```bash
npm test
npm run build
```

Then validate by:
1. Run `npm run watch`
2. Load plugin in Figma development mode
3. Test both "This page" and "Entire file" menu entries
4. Verify description generation and application

## Code Style

- Two-space indentation, single quotes
- PascalCase for components, camelCase for utilities
- Descriptive handler names (e.g., `LoadComponentsHandler`)
- Reuse types from `src/types.ts`
