# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered Figma plugin that generates descriptions for components and component sets using LLM providers (ChatGPT, etc.). Helps designers document their design systems automatically.

## Development Commands

```bash
npm run build    # Build plugin with type checking and minification
npm run watch    # Watch mode for development
```

## Tech Stack

- **Framework:** Preact + TypeScript
- **Build:** create-figma-plugin toolchain
- **Target:** Figma Plugin API

## Architecture

```
src/
├── main.ts          # Plugin entry - command handlers, Figma API interactions
├── ui.tsx           # UI entry point
├── types.ts         # Shared TypeScript types and event handlers
├── components/      # Preact UI components
└── services/        # AI service integrations, prompt logic
build/               # Generated plugin bundle (git-ignored)
```

### Key Patterns

- **Event-based communication:** Uses `emit`/`on` from create-figma-plugin for main↔UI messaging
- **Settings persistence:** Uses Figma's `loadSettingsAsync`/`saveSettingsAsync` for API keys and preferences
- **Scope modes:** "Current page" vs "All pages" - determined at plugin launch

## Plugin Menu

- **Current page:** Process components on the active page only
- **All pages:** Process all components across the document

## Component Types Handled

| Type | Description |
|:-----|:------------|
| COMPONENT | Standalone component |
| COMPONENT_SET | Container for variants |
| VARIANT | Individual variant within a component set |

## Settings

Settings are stored per-user in Figma and include:
- `provider`: AI provider (chatgpt, etc.)
- `apiKey`: User's API key (never committed)
- `customPrompt`: Custom prompt for component descriptions
- `customVariantPrompt`: Custom prompt for variant descriptions
- `includeImage`: Whether to send component image to AI
- `showVariants`: Display variant rows in UI
- `overwriteExisting`: Replace existing descriptions

## Testing

No automated tests. Validate by:
1. Run `npm run watch`
2. Load plugin in Figma development mode
3. Test both "Current page" and "All pages" menu entries
4. Verify description generation and application

## Code Style

- Two-space indentation, single quotes
- PascalCase for components, camelCase for utilities
- Descriptive handler names (e.g., `LoadComponentsHandler`)
- Reuse types from `src/types.ts`
