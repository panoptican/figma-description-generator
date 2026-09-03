# Description Generator

AI-powered Figma plugin that writes documentation-ready descriptions for components, component sets, and variants. Designers run it from the Plugins menu, pick ChatGPT, Claude, or Gemini, review the generated text, and apply it to the canvas. There is no Description Generator server and no account to create: API keys stay in Figma’s per-user plugin storage, and requests go from the plugin iframe to the provider you choose.

This README is for people who want to run the plugin locally, understand how the two-context architecture works, or publish an update to the Figma Community.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Using the Plugin](#using-the-plugin)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Configuration and Settings](#configuration-and-settings)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Security and Privacy](#security-and-privacy)
- [License](#license)

## Key Features

- **Two launch scopes.** `This page` scans the active Figma page. `Entire file` scans every page in the file. Scope is chosen from the menu and does not change mid-session.
- **Component, set, and variant rows.** Standalone components, component sets, and each variant appear as list rows. Sets carry complete variant-set context into prompts.
- **Three AI providers.** ChatGPT (OpenAI), Claude (Anthropic), and Gemini (Google). Users supply their own API key.
- **Generate one, generate set, generate all.** Single-row generate, parent-plus-variants as an atomic set, or a document-wide run with up to three concurrent batches.
- **Icon mode.** Auto-detects icon libraries from component or page names, forces a PNG into the prompt, and uses a naming-style icon prompt instead of prose.
- **Inline edit and revert.** Expanded rows autosave after 800 ms. Revert swaps the last applied description with the previous one.
- **Search, page groups, and export.** Filter by name, page, or properties. Group by page with expand/collapse. Export non-empty descriptions as CSV or JSON.
- **Keyboard shortcuts.** Generate, generate all, focus search, revert, and close modals without leaving the keyboard.

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| **Language** | TypeScript 5.3.3 |
| **UI** | Preact 10.19.3 + JSX |
| **Plugin UI kit** | `@create-figma-plugin/ui` 3.2.0 |
| **Messaging / settings** | `@create-figma-plugin/utilities` 3.2.0 (`emit` / `on`, `loadSettingsAsync` / `saveSettingsAsync`) |
| **Build** | `@create-figma-plugin/build` 4.0.3 (`build-figma-plugin`) |
| **Figma types** | `@figma/plugin-typings` 1.98.0 |
| **Tests** | Vitest 4.0.18, Node environment |
| **Package manager** | npm (`package-lock.json`) |
| **Runtime** | Figma plugin sandbox (main thread + UI iframe) |
| **Hosting** | None. The product runs inside Figma Desktop or Figma in the browser. |

There is no application database, Redis, background-job runner, or `.env` file. Persistent state is Figma `clientStorage` (settings) and Figma node `description` fields (output).

---

## Prerequisites

Install these before the first build:

- **Node.js 24.x** (project pins `24.12.0` in `.nvmrc` and `.node-version`; `package.json` engines are `>=24.0.0 <26.0.0`)
- **npm** 10+ (ships with Node 24)
- **Figma Desktop** on macOS or Windows (required for development plugins and for Community publish)
- An **API key** for at least one provider you intend to exercise:
  - OpenAI: [platform.openai.com](https://platform.openai.com)
  - Anthropic: [console.anthropic.com](https://console.anthropic.com)
  - Google AI Studio: [aistudio.google.com](https://aistudio.google.com)

Optional:

- **nvm**, **fnm**, or **mise** to honor `.nvmrc`
- A Figma file with components, at least one component set with variants, and (for icon mode) a page named something like `Icons`

This plugin does **not** need PostgreSQL, Redis, Docker, or any cloud project to run locally.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/panoptican/figma-description-generator.git
cd figma-description-generator
```

If you use nvm:

```bash
nvm use
```

You should see Node `v24.12.0` (or another 24.x). Confirm:

```bash
node -v   # v24.12.0
npm -v
```

### 2. Install Dependencies

```bash
npm install
```

This installs Preact, the create-figma-plugin toolchain, Figma typings, TypeScript, and Vitest. There are no native addons that need Homebrew or `apt` packages.

### 3. Environment Setup

There is nothing to copy. There is no `.env.example`.

API keys are entered later inside the plugin Settings modal and stored with Figma’s `saveSettingsAsync`. Do not put keys in the repo, in shell profiles used for demos, or in issue reports.

### 4. Build Once (optional sanity check)

```bash
npm test
npm run build
```

Expected:

- Vitest: **9 files, 135 tests**, all passing
- `build-figma-plugin` writes `build/main.js`, `build/ui.js`, and regenerates `manifest.json`

`manifest.json` is the Figma entry. The build reads the `figma-plugin` block in `package.json` and emits:

```json
{
  "api": "1.0.0",
  "editorType": ["figma"],
  "id": "description-generator",
  "name": "Description Generator",
  "main": "build/main.js",
  "ui": "build/ui.js",
  "menu": [
    { "name": "This page", "command": "src/main.ts--currentPage" },
    { "name": "Entire file", "command": "src/main.ts--allPages" }
  ],
  "networkAccess": {
    "allowedDomains": [
      "https://api.openai.com",
      "https://api.anthropic.com",
      "https://generativelanguage.googleapis.com"
    ]
  }
}
```

The committed `id` (`description-generator`) is a **development** id. A Community listing needs a numeric id Figma generates at publish time. See [Deployment](#deployment).

### 5. Start Watch Mode

```bash
npm run watch
```

This runs `build-figma-plugin --typecheck --watch`. Leave it running. Every save type-checks and rewrites `build/` plus `manifest.json`.

You will not get a `localhost` URL. The UI only exists inside Figma.

### 6. Load the Plugin in Figma Desktop

1. Open Figma Desktop.
2. Open any design file that contains components.
3. **Plugins → Development → Import plugin from manifest…**
4. Select this repo’s `manifest.json` (the file at the project root, not a file inside `build/`).
5. Run **Plugins → Development → Description Generator → This page**.

The plugin window is **960×800**. The first paint is `Loading components…`. Then the header and page-grouped list appear. With no API key, a banner says to add one in Settings.

On later code changes:

1. Wait for the watch process to finish rebuilding.
2. In Figma, reopen the plugin (or use **Plugins → Development → Description Generator** again). Figma does not hot-reload the iframe for you.

### 7. First-Run Settings

1. Click the gear icon.
2. Choose a provider.
3. Paste an API key (the field is a password input).
4. Click **Validate** (optional; 5 second timeout). Save works even if you skip Validate.
5. Click **Save**.

Generate buttons stay disabled until a key is saved. A banner with **Open Settings** appears until then.

---

## Using the Plugin

### Menu entries

| Menu | What it scans | Page-change behavior |
| --- | --- | --- |
| **This page** | `figma.currentPage` only | Changing the Figma page rescans automatically |
| **Entire file** | Every page under `figma.root.children` | Changing the Figma page does **not** rescan; use the refresh button |

Closing the window ends the session. Choosing the other menu item later is a new launch, not a live scope switch.

### Header

Left to right:

1. **Scope** — `This page · {page name}` or `Entire file`, matching the menu entry used to launch.
2. **Search** — case-insensitive match on component name, page name, and properties. Shortcut: `⌘F` / `Ctrl+F`.
3. **Fill N** / **Replace N** — `N` is the number of pending members in the current batch plan. **Fill** skips components that already have text; **Replace** overwrites them. Disabled without an API key or when `N` is 0. While running it becomes **Stop remaining (current/total)**.
4. **Refresh** — explicit rescan. Tooltip is “Rescan this page” or “Rescan entire file”. Disabled while refreshing or while a batch is running.
5. **Export** — opens CSV/JSON export. Disabled when the filtered list has no non-empty descriptions.
6. **Settings** — provider, key, prompts, toggles.

### Component list

Rows are grouped by `pageName`. Each page header is sticky and shows `N of M described`. Click the header to collapse the page. **Expand All** / **Collapse All** toggles row expansion on that page. A checkmark replaces those buttons when every row on the page has a description.

Empty copy: `No matches for “{search}”.` when search has no hits; `No components on this page. Close and run Entire file to scan the whole file.` for This page with an empty inventory; `No components in this file.` for Entire file with none.

### Row types

| Type | How it appears | Generate actions |
| --- | --- | --- |
| `COMPONENT` | Standalone component (not a child of a set) | **Generate** |
| `COMPONENT_SET` | Parent of variants | **Generate this set** (the set only) and **Generate set and variants** (sequential) |
| `VARIANT` | Child of a set; indented | No isolated Generate. Link: **Open “{parent}”** opens the parent. `⌘G` / `Ctrl+G` on a selected variant runs Generate set and variants on the parent. |

Click the **name** to select the node on the canvas, switch to its page if needed, and zoom the viewport to it. Click the rest of the collapsed row to expand it.

### Description status

| Status | Meaning | Collapsed cue |
| --- | --- | --- |
| **Missing** | Empty or whitespace-only description | Italic “No description”, no status dot |
| **Existing** | Non-empty text that was not generated in this session | Green dot |
| **Generated** | Applied by a generate in this session | Amber dot and warm row tint |

### Editing, apply, revert

There is no Save button.

- Expanding a row shows a textarea. Typing marks the row **Unsaved changes**.
- After **800 ms** idle, the plugin applies the text to `node.description` and shows **Saving…**.
- Collapsing a dirty row applies immediately.
- Unmounting a dirty row (list reload) also flushes the pending text.
- Successful generate applies immediately and stores the prior text as `previousDescription`.
- **Revert** (or `⌘Z` / `Ctrl+Z` when focus is not in a text field) swaps current and previous on both the list and the canvas. A second Revert toggles back.

`overwriteExisting` does **not** protect single-row Generate, Generate this set, or Generate set and variants. Those always replace the current description. The toggle only filters Fill / Replace.

### Generate All

1. The run snapshots batches from the full inventory plus the current filtered list.
2. Variant rows are never top-level targets. If search or “show variants” leaves only a variant visible, the parent set is still targeted so the set stays atomic.
3. With **Overwrite existing descriptions when generating all** off, members that already have a real description are dropped from the batch. Whitespace-only counts as missing.
4. Up to **3** workers pull batches from a shared queue. Inside a set batch, members run **one after another**.
5. **Stop remaining** sets an abort flag and aborts the in-flight `fetch`. Members already applied stay applied. A provider response that arrives after stop is **not** written to the canvas.
6. There is no batch-level undo. Use per-row Revert.

### Icon mode

A row is auto-icon when:

- the component or set name matches `/^icon\b/i` (for example `Icon`, `Icon Arrow`), or
- the **page** name matches `/\bicons?\b/i` (for example `Icons`, `SYSTEM ICON LIBRARY`, but not `Iconography`).

Variants inherit the **parent set name** plus the page name, not the variant property string.

The expanded **Icon** chip cycles: no override → force the opposite of auto → clear override. Overrides persist in settings as `iconOverrides` and survive closing the plugin.

When icon mode is on:

- the plugin always attempts a PNG export, even if **Include component image** is off
- the icon prompt is used (default output is a comma-separated list of alternative names)
- complete variant-set context is **not** appended

If export fails, generation continues without an image rather than failing the job.

### Keyboard shortcuts

Shortcuts are registered after the list loads. `Mod` is `⌘` on Mac and `Ctrl` elsewhere.

| Shortcut | Action | Notes |
| --- | --- | --- |
| `Mod+G` | Generate the selected row | On a variant, runs Generate set and variants on the parent. Ignored while typing in an input or textarea. |
| `Mod+Shift+G` | Generate All | No-op without a key or while Generate All is already running. |
| `Mod+F` | Focus and select the search field | Works even when focus is already in a text field. |
| `Mod+Z` | Revert the selected row | Ignored while typing in a text field. |
| `Escape` | Close Settings if open, else close Export | Does **not** stop Generate All. An expanded row has its own Escape listener that collapses the row. |

### Export

Export uses the **filtered** list (search + show-variants), not the unfiltered document.

| Format | Filename | Contents |
| --- | --- | --- |
| CSV | `component-descriptions-YYYY-MM-DD.csv` | Header plus rows: Component ID, Component Name, Page Name, Type, Properties (joined with `; `), Description. Values with commas, quotes, or newlines are RFC-style escaped. |
| JSON | `component-descriptions-YYYY-MM-DD.json` | Pretty-printed array of `{ componentId, componentName, pageName, type, properties, description }` |

Rows with empty descriptions are omitted. Download is a temporary `<a download>` click in the iframe.

---

## Architecture

The plugin is two isolated JavaScript worlds that talk over typed events.

```
┌─────────────────────────────────────────────────────────────┐
│ Figma desktop / browser                                      │
│                                                              │
│  Main thread (src/main.ts)          UI iframe (src/ui.tsx)   │
│  ─────────────────────────          ──────────────────────   │
│  Figma Plugin API                   Preact App               │
│  • findAllWithCriteria              • Header / list / rows   │
│  • node.description writes          • Settings / Export      │
│  • exportAsync PNG                  • Keyboard shortcuts     │
│  • clientStorage settings           • fetch() to AI APIs     │
│  • selection + viewport             • CSV/JSON download      │
│           │                                    │             │
│           └──────── emit / on (postMessage) ───┘             │
└─────────────────────────────────────────────────────────────┘
          │
          ├── https://api.openai.com
          ├── https://api.anthropic.com
          └── https://generativelanguage.googleapis.com
```

The main thread is the authority for the Figma document and for persisted settings. The UI is the authority for ephemeral list state, generation jobs, and provider HTTP. The UI never calls the Figma API directly.

### Directory Structure

```
description-generator/
├── src/
│   ├── main.ts                      # Menu handlers, Figma API, event server
│   ├── ui.tsx                       # Preact mount; passes scope + currentPageName
│   ├── types.ts                     # ComponentData, Settings, EventHandler contracts
│   ├── components/
│   │   ├── App.tsx                  # Session state, generate orchestration
│   │   ├── Header.tsx               # Search, Generate All, refresh, export, settings
│   │   ├── ComponentList.tsx        # Page groups, expand/collapse, scroll-to-parent
│   │   ├── ComponentRow.tsx         # Collapsed/expanded row, dirty autosave
│   │   ├── SettingsModal.tsx        # Provider, key, prompts, validate
│   │   └── ExportModal.tsx          # CSV vs JSON
│   ├── services/
│   │   ├── ai.ts                    # Prompts, models, provider fetch
│   │   ├── ai.test.ts
│   │   ├── validation.ts            # Lightweight API-key checks
│   │   └── validation.test.ts
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useKeyboardShortcuts.test.ts
│   └── utils/
│       ├── export.ts                # CSV/JSON + data URLs
│       ├── filters.ts               # Search, show-variants, page grouping helpers
│       ├── generationBatches.ts     # Generate All batch plan
│       ├── descriptionStatus.ts     # missing / existing / generated
│       ├── icon.ts                  # Auto icon detection
│       ├── text.ts                  # Empty-description + variant-name parsing
│       └── *.test.ts
├── build/                           # Generated main.js + ui.js (gitignored)
├── manifest.json                    # Generated + committed Figma entry
├── package.json                     # Scripts, deps, figma-plugin menu config
├── tsconfig.json                    # Extends @create-figma-plugin/tsconfig
├── vitest.config.ts                 # globals, node env, src/**/*.test.ts
├── release/                         # Community listing copy, QA, artwork
│   ├── community-listing.md
│   ├── qa-checklist.md
│   └── assets/                      # icon.png 128×128, thumbnail.png 1920×1080
├── specs/                           # Feature specs for the Ralph loop
├── scripts/
│   ├── ralph-loop.sh                # Autonomous implement-from-specs loop
│   └── ralph-loop-codex.sh
├── .github/ISSUE_TEMPLATE/          # Bug report form
├── .nvmrc / .node-version           # 24.12.0
├── AGENTS.md / CLAUDE.md            # Agent-facing repo notes
└── README.md
```

Local-only (gitignored) directories you may also see: `node_modules/`, `build/`, `logs/`, `.cursor/`, `.specify/`, `product-description/` (companion behavior-spec checkout).

### Request Lifecycle

**Launch**

1. User chooses **This page** or **Entire file**.
2. Figma calls `currentPage()` or `allPages()` in `src/main.ts`.
3. `initPlugin(scope)` calls `showUI({ width: 960, height: 800 }, { scope, currentPageName })`.
4. Main thread deletes legacy `description-cache` from `clientStorage`.
5. `src/ui.tsx` renders `<App scope currentPageName />`.
6. App emits `LOAD_SETTINGS` and `LOAD_COMPONENTS`.
7. Main thread loads settings (and strips removed fields `enableFallback` / `providerChain`) and runs `getComponents(scope)`.
8. App replaces the loading screen with the list.

**Generate one**

1. User clicks **Generate** or presses `Mod+G`.
2. If `includeImage` or icon mode is on, App emits `EXPORT_IMAGE` and waits on a per-id Promise.
3. Main thread `exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } })`, base64-encodes bytes, emits `IMAGE_EXPORTED`.
4. `generateDescription()` in `src/services/ai.ts` builds a prompt and `fetch`es the selected provider from the **UI iframe**.
5. App applies the text locally (stores previous), emits `APPLY_DESCRIPTION`.
6. Main thread writes `node.description` if the node is `COMPONENT` or `COMPONENT_SET`, then emits `DESCRIPTION_APPLIED`.

**Generate All**

Same per-member path, but `getGenerationBatches()` plans work and three queue workers run batches. Set members stay sequential inside one batch.

**Settings**

1. Modal Save emits `SAVE_SETTINGS` with the form plus current `iconOverrides`.
2. Main thread `saveSettingsAsync`.
3. Icon-chip toggles also emit `SAVE_SETTINGS` immediately, without opening the modal.

**Select on canvas**

Name click emits `SELECT_COMPONENT`. Main thread walks parents to find the `PAGE`, sets `figma.currentPage`, assigns `selection`, and `scrollAndZoomIntoView`.

### Data Flow

```
Figma document
    │ findAllWithCriteria(COMPONENT, COMPONENT_SET)
    ▼
ComponentData[]  ──COMPONENTS_LOADED──►  App state
                                              │
                     search / showVariants    │
                                              ▼
                                       filtered list
                                              │
                    Generate / Generate set and variants / Fill N
                                              │
                         optional EXPORT_IMAGE
                                              ▼
                                    generateDescription()
                                              │
                         APPLY_DESCRIPTION    │
                                              ▼
                                    node.description
                                              │
                         DESCRIPTION_APPLIED  │
                                              ▼
                                    row status / errors
```

### Key Components

**`src/main.ts` — plugin layer**

- `getComponents(scope)` walks pages, emits a `COMPONENT_SET` row plus a `VARIANT` row per child, and skips components whose parent is already a set (those appear only as variants).
- Variant properties come from `componentPropertyDefinitions` when available, otherwise from splitting variant names on commas.
- `isIconComponent(name, pageName)` stamps `isIcon` at scan time.
- Current-page mode registers `figma.on('currentpagechange', …)` and unregisters it on close.

**`src/components/App.tsx` — UI orchestrator**

Owns components, settings, search, Generate All progress, row errors, selection, icon overrides, and the image-export Promise map (`Map<id, resolve>` so concurrent exports cannot clobber each other). `CONCURRENCY_LIMIT` is `3`.

**`src/services/ai.ts` — provider router**

| Provider | Model constant | Endpoint | Auth |
| --- | --- | --- | --- |
| ChatGPT | `gpt-5.6-luna` | `POST https://api.openai.com/v1/responses` | `Authorization: Bearer` |
| Claude | `claude-haiku-4-5` | `POST https://api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-version: 2023-06-01` + `anthropic-dangerous-direct-browser-access: true` |
| Gemini | `gemini-3.6-flash` | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=` | Query param |

Claude and ChatGPT cap output at 256 tokens (`max_tokens` / `max_output_tokens`). Images are PNG base64 (Claude `image` block, Gemini `inlineData`, OpenAI `input_image` data URL).

**Prompt templates**

- `DEFAULT_PROMPT` — 1–2 sentence Polaris-style component copy. Placeholders: `{name}`, `{type}`, `{properties}`.
- `DEFAULT_VARIANT_PROMPT` — one sentence of difference/when-to-use. Placeholders: `{name}`, `{parentName}`, `{properties}`.
- `DEFAULT_ICON_PROMPT` — 10–15 lowercase search names. Placeholders: `{icon_name}`, `{parentName}`.

`buildPrompt()` picks icon → variant → component, then for non-icon prompts appends:

```
Complete variant set context:
- size=small, tone=neutral: size=small, tone=neutral
- ...
```

If a custom variant/icon template omits `{parentName}` but a parent exists, a `Parent component:` line is appended.

**`src/services/validation.ts`**

| Provider | Validate call | Token use |
| --- | --- | --- |
| ChatGPT | `GET /v1/models` | None |
| Gemini | `GET /v1beta/models?key=` | None |
| Claude | `POST /v1/messages` with `max_tokens: 1` and body `"Hi"` | Minimal (Claude has no key-safe models list that works here) |

Mapped errors: 401 → `Invalid API key`, 403 → `API key does not have access`, 429 → `Rate limited - try again later`, abort → `Validation timed out after 5 seconds`.

**`src/utils/generationBatches.ts`**

`getGenerationBatches(all, filtered, overwriteExisting)` returns `{ members }[]`. Used both for the header count and for the Generate All queue.

### Event Protocol

Every event is declared as an `EventHandler` in `src/types.ts`.

| Event | Direction | Payload |
| --- | --- | --- |
| `LOAD_COMPONENTS` | UI → main | none |
| `COMPONENTS_LOADED` | main → UI | `ComponentData[]` |
| `LOAD_SETTINGS` | UI → main | none |
| `SETTINGS_LOADED` | main → UI | `Settings` |
| `SAVE_SETTINGS` | UI → main | `Settings` |
| `SETTINGS_SAVED` | main → UI | none |
| `APPLY_DESCRIPTION` | UI → main | `{ id, description }` |
| `DESCRIPTION_APPLIED` | main → UI | `{ id, success }` |
| `SELECT_COMPONENT` | UI → main | `{ id }` |
| `EXPORT_IMAGE` | UI → main | `{ id }` |
| `IMAGE_EXPORTED` | main → UI | `{ id, imageBase64 }` |
| `CLOSE_PLUGIN` | UI → main | none (handler exists; the window close path also ends the plugin) |

### Data Model

**`ComponentData`** (in-memory, rebuilt every scan)

```
id                    Figma node id
name                  Node name
type                  COMPONENT | COMPONENT_SET | VARIANT
properties            Variant axis strings, e.g. "Size: small, large"
currentDescription    Last known node.description
previousDescription   Prior value after an apply (session only)
pageName              Owning page
parentName / parentId Set membership for VARIANT
variantContext        All variants in the set: [{ name, properties }]
isIcon                Auto-detect flag from scan
```

**`Settings`** (Figma `clientStorage`, per user, not per file)

```
provider              'chatgpt' | 'claude' | 'gemini'   default: chatgpt
apiKey                string                            default: ''
customPrompt          string                            default: ''
customVariantPrompt   string                            default: ''
customIconPrompt      string                            default: ''
includeImage          boolean                           default: false
showVariants          boolean                           default: true
overwriteExisting     boolean                           default: false
iconOverrides         Record<nodeId, boolean>           optional
```

Empty custom prompt fields in the modal **display** the default template. Saving an untouched default does not persist it as a custom prompt (`customPrompt || defaultPrompt` in the textarea; Save writes the state value, which stays `''` until the user edits).

There is no SQL schema, migration, or seed file.

### Error Handling

- Provider HTTP failures become `Error('ChatGPT API error: …')` (or Claude/Gemini) and land in `rowErrors` / the expanded row.
- Apply to a missing or non-component node emits `success: false` → `Failed to apply description to canvas`.
- Image export failures emit `imageBase64: null`; generate continues text-only.
- Generate All failures on one member do not stop other batches. Failed names stay in the list with an error string.
- Logging is `console.error` only. No telemetry.

### What was removed on purpose

Earlier versions had description caching, provider fallback chains, and auto-retry. Those were deleted (see `specs/simplification/`). On init the plugin still deletes leftover `description-cache` keys.

---

## Environment Variables

There are **no required or optional environment variables**.

| Variable | Status |
| --- | --- |
| `DATABASE_URL` | Not used |
| `SECRET_KEY_BASE` / `RAILS_MASTER_KEY` | Not used |
| `REDIS_URL` | Not used |
| Provider API keys as `OPENAI_API_KEY` etc. | Not used — keys are entered in the plugin UI |

`.gitignore` ignores `.env` and `.env.*` (except `.env.example`) so a stray file is not committed by accident. Do not add a `.env` for this app; the create-figma-plugin runtime will not read it, and a key in the working tree is a leak.

Developer machine setup is Node 24 + npm + Figma Desktop. All runtime configuration is [Settings](#configuration-and-settings).

---

## Configuration and Settings

Configuration is the Settings modal plus the `figma-plugin` block in `package.json`.

### Required to generate

| Setting | Description | How to get it |
| --- | --- | --- |
| **API key** | Provider secret stored in Figma `clientStorage` | OpenAI / Anthropic / Google AI Studio dashboard |

### Optional settings

| Setting | Default | Effect |
| --- | --- | --- |
| Provider | ChatGPT | Which HTTP API and model run |
| Include component image | off | Attach a 1× PNG to non-icon prompts |
| Show variants in list | on | Hide `VARIANT` rows when off (sets remain) |
| Overwrite existing when generating all | off | Include already-described members in Generate All |
| Component / variant / icon prompts | built-in templates | Override `{name}`, `{type}`, `{properties}`, `{parentName}`, `{icon_name}` |
| Icon overrides | none | Per-id force on/off, persisted with settings |

### Network allowlist

Figma only permits fetches to hosts listed in `package.json` → `figma-plugin.networkAccess.allowedDomains`. Adding a fourth provider requires:

1. A new `AIProvider` union member in `src/types.ts`
2. `generateWith…` + `validate…` implementations
3. Dropdown option in `SettingsModal.tsx`
4. The new origin in `package.json` (rebuild so `manifest.json` updates)
5. Tests in `ai.test.ts` and `validation.test.ts`

Do not fetch arbitrary URLs. Figma will block them.

### Example settings payload

```json
{
  "provider": "chatgpt",
  "apiKey": "(not in git)",
  "customPrompt": "",
  "customVariantPrompt": "",
  "customIconPrompt": "",
  "includeImage": false,
  "showVariants": true,
  "overwriteExisting": false,
  "iconOverrides": {
    "12:34": true
  }
}
```

---

## Available Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies from `package-lock.json` |
| `npm test` | Vitest once (`vitest run`) — 135 tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run build` | Typecheck, bundle, minify → `build/` + `manifest.json` |
| `npm run watch` | Typecheck and rebuild on save (use while Figma is open) |
| `npm audit` | Production+dev vulnerability scan (used in release QA) |
| `npm audit --omit=dev` | Production-only audit |
| `./scripts/ralph-loop.sh` | Optional autonomous loop: pick the next incomplete spec in `specs/` and implement it |
| `./scripts/ralph-loop.sh 10` | Same loop, max 10 iterations |
| `./scripts/ralph-loop.sh plan` | Planning mode |

There is no `bin/dev`, no Rails console, no database command, and no asset precompile step beyond `npm run build`.

---

## Testing

### Running Tests

```bash
# All unit tests once (CI-equivalent local command)
npm test

# Watch
npm run test:watch

# One file
npx vitest run src/services/ai.test.ts

# Tests matching a name
npx vitest run -t "buildPrompt"

# Production bundle (typecheck + minify) after tests
npm run build
```

Vitest is configured in `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`tsconfig.json` excludes `src/**/*.test.ts` from the plugin compile so test-only types never enter `build/`.

There is **no coverage reporter** and **no GitHub Actions workflow** yet. Treat `npm test && npm run build` as the required gate before a Figma hand test.

### Test Structure

Tests are colocated next to the module, not under `src/**/__tests__`:

```
src/services/ai.test.ts
src/services/validation.test.ts
src/hooks/useKeyboardShortcuts.test.ts
src/utils/export.test.ts
src/utils/filters.test.ts
src/utils/generationBatches.test.ts
src/utils/descriptionStatus.test.ts
src/utils/icon.test.ts
src/utils/text.test.ts
```

**135 tests / 9 files** cover:

- Prompt selection (component vs variant vs icon, custom templates, parent fallback, variant-set context, icon skipping context)
- Provider response parsing and HTTP error wrapping (mocked `fetch`)
- API-key validation status mapping and 5 s abort
- Generate All batch membership and overwrite filtering
- CSV escaping, JSON export, dated filenames (fake timers)
- Search / show-variants filters and missing-description counts
- Icon name and page-name regexes
- Description status and empty-whitespace handling
- Shortcut modifier detection (`⌘` vs `Ctrl+`)

**Not automated:** Preact components, `App.tsx` job orchestration, and `main.ts` Figma API calls. Those require Figma Desktop.

### Writing Tests

Colocate `foo.test.ts` next to `foo.ts`. Use a small factory for `ComponentData`. Mock `globalThis.fetch` and restore it in `afterEach`.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateDescription } from './ai'

describe('generateDescription', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  it('returns trimmed ChatGPT response text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: '  Displays a primary action.  ' })
    }) as unknown as typeof fetch

    const result = await generateDescription(
      'chatgpt',
      'sk-test',
      'Button',
      'COMPONENT',
      ['Size']
    )

    expect(result).toBe('Displays a primary action.')
  })
})
```

### Manual Figma validation

After `npm run watch`:

1. Import / reload the development plugin from `manifest.json`.
2. Exercise **This page** and **Entire file**.
3. Generate a standalone component, a set (Generate this set + Generate set and variants), and an icon-mode row.
4. Run Generate All on at least three pending members; confirm progress and Cancel.
5. Turn on include-image and confirm a PNG goes out (provider still returns text).
6. Toggle Icon, quit the plugin, reopen, confirm the override stuck.
7. Edit a textarea, wait for autosave, Revert, try `Mod+G` / `Mod+Shift+G` / `Mod+F`.
8. Paste a bad key and confirm a readable validation or row error.
9. Confirm `manifest.json` still lists all three provider domains.

A longer checklist lives in [`release/qa-checklist.md`](release/qa-checklist.md).

A narrative, event-by-event product description (what the user sees, including interrupts) lives in the optional local `product-description/` checkout. That tree is gitignored and is not required to build the plugin.

---

## Deployment

This is a **Figma plugin**, not a web service. There is no Dockerfile, no `Procfile`, no Kamal/Fly/Render config, and nothing to SSH into. “Production” means: a built `build/main.js` + `build/ui.js` loaded by Figma, either as a development plugin or as a reviewed Community / organization plugin.

### 1. Development plugin (every engineer)

Covered in [Getting Started](#getting-started). Point Figma at this repo’s `manifest.json`. Suitable for local work and for sharing a private drop with someone who can import the same folder.

### 2. Private organization plugin

On Organization and Enterprise plans, the publish modal’s **Publish to** control can target the organization instead of Community. Figma does not run the public review pipeline for org-only plugins. You still build with `npm run build`, still need Desktop, and still need 2FA on the publishing account.

### 3. Figma Community (public)

Draft listing copy and artwork are in [`release/`](release/README.md):

| File | Use |
| --- | --- |
| `release/community-listing.md` | Name, tagline, description, category, support URL |
| `release/assets/icon.png` | 128×128 plugin icon |
| `release/assets/thumbnail.png` | 1920×1080 listing thumbnail |
| `release/qa-checklist.md` | Automated + Desktop QA before submit |

**Before you open the publish modal**

```bash
npm test
npm run build
npm audit
npm audit --omit=dev
```

Then run the Desktop checklist in `release/qa-checklist.md`.

**Publish (Figma Desktop only)**

1. Enable two-factor authentication on the Figma account that will own the listing. Figma requires 2FA to publish.
2. Import the built plugin if it is not already in **Plugins → Development**.
3. **Plugins → Manage plugins** (or the plugin’s `…` menu) → **Publish**.
4. If Figma reports an invalid id, click **Generate ID**, paste the numeric id into `package.json` under `figma-plugin.id` (so the next build rewrites `manifest.json`), rebuild, and re-import.
5. Fill the listing from `release/community-listing.md`:
   - Name: Description Generator
   - Tagline: Generate clear, useful descriptions for your Figma components with AI.
   - Category: Design tools
   - Support: https://github.com/panoptican/figma-description-generator/issues
6. Upload `release/assets/icon.png` and `release/assets/thumbnail.png`.
7. Confirm network access shows **Restricted** to OpenAI, Anthropic, and Google Generative Language — not Unknown or Unrestricted.
8. Complete the data-security disclosure: keys are stored in Figma client storage; component names, properties, and optional PNGs are sent only to the selected provider; there is no Description Generator backend.
9. Submit for review. First reviews can take days. You can push code updates while the listing is In review.

**Publish an update**

```bash
npm test
npm run build
```

Then **Publish** again from Desktop. Bump the human-facing listing notes when behavior changes (new provider, new prompt variables, new network host).

**Do not** change `networkAccess` in a way that widens the allowlist without documenting it in the PR and the Community disclosure.

### Why not Docker?

A container can run `npm ci && npm test && npm run build`, but it cannot load the plugin. Figma hosts the runtime. If you want a reproducible CI image later, use Node 24 and `npm ci`; do not try to “deploy” `build/` to a VPS.

---

## Troubleshooting

### `npm install` fails on engine check

**Error:** `The engine "node" is incompatible` or a create-figma-plugin toolchain error on Node 18/20/22.

**Solution:** Use Node 24.

```bash
nvm install 24.12.0
nvm use
node -v
```

### Watch or build type errors

**Error:** `build-figma-plugin` exits during `--typecheck`.

**Solution:** Fix the TypeScript error. Tests are excluded from `tsconfig.json`, so a red test file will not fail the plugin build — only `src/**/*.ts(x)` that are not `*.test.ts`. Run `npm test` separately.

### Plugin menu missing after import

**Solution:**

1. Confirm you selected the **root** `manifest.json`, and that `build/main.js` and `build/ui.js` exist.
2. Run `npm run build` once if you imported before installing.
3. Remove the development plugin (**Manage plugins in development → … → Remove**) and import again.

### Changes do not appear in Figma

Watch mode rewrites `build/`, but the open plugin iframe keeps the old bundle.

**Solution:** Close the plugin window and run the menu command again after the watch log goes idle.

### Generate buttons stay disabled

**Cause:** No API key in saved settings.

**Solution:** Settings → paste a key → Save. Validate is optional. `hasApiKey` is a truthy check on the saved string.

### `Invalid API key` / `API key does not have access` / `Rate limited`

Validate and generate surface provider status codes:

| Message | Typical cause |
| --- | --- |
| `API key is required` | Empty field |
| `Invalid API key` | 401 (OpenAI/Claude) or Gemini 400 mentioning API key |
| `API key does not have access` | 403 |
| `Rate limited - try again later` | 429 |
| `Validation timed out after 5 seconds` | Network blocked or provider hang |
| `ChatGPT API error: …` | Generate-time HTTP body from OpenAI |
| `Failed to apply description to canvas` | Node id missing or not a COMPONENT / COMPONENT_SET |

**Solution:** Confirm the key matches the selected provider, that billing is enabled on that provider, and that Figma’s network allowlist still includes that host. Corporate proxies that intercept HTTPS will fail these calls.

### Claude works in curl but fails in the plugin

Claude requires `anthropic-dangerous-direct-browser-access: true` because the call is made from the plugin iframe, not a server. That header is already set in `ai.ts` and `validation.ts`. If you add a new Claude call, keep the header.

### Images never attach

**Causes:**

- **Include component image** is off **and** the row is not in icon mode.
- `exportAsync` failed (node gone, export error) — generate still runs, text-only.
- Generate All cancel happened after export but before apply.

**Solution:** Expand the row and check `Source: Icon prompt` vs `Default prompt`. Toggle Icon if you expected an image. Watch the Figma console for `Failed to export image:`.

### This page list does not follow the canvas

You launched **Entire file**. That scope is document-wide and only refreshes on the header refresh button (or relaunch). Use **This page** for automatic `currentpagechange` rescans.

### Generate All skipped rows I can see

With overwrite off, members that already have a description are not pending. Search can hide a parent while still targeting its set if a matching variant is visible — or the opposite, drop a standalone component that does not match. Check the **Generate All (N)** count after clearing search.

### Generate All stopped but some descriptions changed

Stop remaining is not transactional. Already-applied members keep the new text. Late provider responses after abort are dropped. Revert row-by-row, or use Figma undo on the canvas.

### Export downloads an empty-feeling file

Export skips empty descriptions and uses the **filtered** list. Clear search and turn **Show variants** on if you expected more rows. Filename date is UTC (`toISOString().slice(0, 10)`).

### Icon badge on everything

A page named `Icons` (or containing the word `icon` / `icons`) marks every component on that page as auto-icon. Toggle the Icon chip to force off; that override persists.

### Settings did not save

Cancel or Escape discards the modal. Validate success is not required, but you must click **Save**. Icon overrides from the row chip save immediately and independently of the modal.

### `description-cache` in client storage

Safe to ignore. Init deletes that key from an older caching design.

### Community publish: invalid id

`package.json` currently ships `"id": "description-generator"`. Figma Community needs the numeric id from **Generate ID**. Put that number in `figma-plugin.id`, rebuild, re-import, then publish.

---

## Contributing

### Bugs

Use the GitHub bug form: [.github/ISSUE_TEMPLATE/bug.yml](.github/ISSUE_TEMPLATE/bug.yml). Do not paste API keys. Include Figma client (Desktop/Browser), OS, menu entry, provider, and whether include-image was on.

Issues: https://github.com/panoptican/figma-description-generator/issues

### Code style

- TypeScript + Preact function components
- Two-space indent, single quotes, semicolons, trailing commas in multi-line literals
- PascalCase component files (`ComponentRow.tsx`), camelCase utilities (`generationBatches.ts`)
- Event handler types end in `Handler` (`ApplyDescriptionHandler`)
- Named exports (except `src/ui.tsx`, which default-exports the render wrapper)
- Reuse `src/types.ts` instead of inlining shapes
- No Prettier/ESLint config is checked in; match the file you are editing

### Pull requests

1. Keep the diff focused.
2. Add or update a colocated `*.test.ts` when you change a pure helper or provider client.
3. Run `npm test` and `npm run build`.
4. Note which Figma menu entries, providers, and edge cases you clicked (component sets, icons, Generate All cancel, invalid key).
5. Attach a screenshot or GIF for UI changes.
6. Call out `manifest.json` / `networkAccess` edits in the summary.

Commit messages are short and imperative: `Add collapsible page rows`, `Update default prompts`.

### Adding a spec (autonomous loop)

Specs in `specs/` are markdown work items for `./scripts/ralph-loop.sh`. The loop picks the highest-priority file that is not marked complete. You do not need Ralph to contribute by hand.

### Where new code goes

| Change | Put it here |
| --- | --- |
| New menu command or Figma API | `src/main.ts` + event type in `src/types.ts` |
| New screen or control | `src/components/` |
| New provider | `src/services/ai.ts`, `validation.ts`, Settings dropdown, `package.json` allowlist |
| Pure transform | `src/utils/` + colocated test |
| Shortcut | `src/hooks/useKeyboardShortcuts.ts` |

---

## Security and Privacy

- **No Description Generator backend.** Keys and component data are not sent to this project’s authors.
- **Keys** live in Figma `clientStorage` for the signed-in user. They are not in git. The Settings field is `password`. Still treat client storage as local-plaintext and rotate a key if a machine is shared.
- **Outbound data** on generate: component name, type, properties, optional parent name, optional variant-set context, optional PNG, and the prompt template. Review your provider’s terms before sending proprietary UI.
- **Network allowlist** is the three official API hosts only.
- **Apply** writes only `COMPONENT` and `COMPONENT_SET` descriptions. It does not rename layers or edit other node fields.
- **Claude** calls include `anthropic-dangerous-direct-browser-access` because the iframe is a browser context. Do not reuse that header on a server.

---

## License

`package.json` declares **MIT**. There is not a separate `LICENSE` file in the tree today.

---

## Related documents

| Path | What it is |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Short contributor map for coding agents |
| [`CLAUDE.md`](CLAUDE.md) | Same, Claude-oriented |
| [`release/community-listing.md`](release/community-listing.md) | Community listing draft |
| [`release/qa-checklist.md`](release/qa-checklist.md) | Pre-publish QA |
| [`specs/`](specs/) | Historical and in-progress feature specs |

Official Figma references:

- [Plugin manifest](https://developers.figma.com/docs/plugins/manifest/)
- [Publish classic plugins to the Figma Community](https://help.figma.com/hc/en-us/articles/360042293394-Publish-classic-plugins-to-the-Figma-Community)
- [create-figma-plugin](https://yuanqing.github.io/create-figma-plugin/)
