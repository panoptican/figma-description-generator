# Technology Stack

**Analysis Date:** 2026-08-19

## Languages

**Primary:**
- TypeScript 5.3.3 - UI components, services, and plugin logic
- JSX (Preact) - Component rendering in `src/components/`

**Secondary:**
- JSON - Configuration and manifest files

## Runtime

**Environment:**
- Node.js (via build toolchain)
- Figma Plugin Runtime - Executes plugin in Figma's sandboxed environment

**Package Manager:**
- npm - Installed dependencies via `package.json` with lockfile present (`package-lock.json`)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Preact 10.19.3 - Lightweight UI framework for Figma plugin interface
- @create-figma-plugin/ui 3.2.0 - Figma-native UI components library
- @create-figma-plugin/utilities 3.2.0 - Event emission and plugin utilities (emit/on messaging)

**Build/Dev:**
- @create-figma-plugin/build 4.0.3 - Custom build tool for Figma plugins with typecheck and minify support
- @create-figma-plugin/tsconfig 3.2.0 - Shared TypeScript configuration for Figma plugins

**Testing:**
- Vitest 4.0.18 - Test runner for unit and integration tests

## Key Dependencies

**Critical:**
- @figma/plugin-typings 1.98.0 - Type definitions for Figma Plugin API (figma global, component nodes, etc.)

**Infrastructure:**
- No database ORM or external service client libraries - API calls made directly via `fetch()` to three AI providers

## Configuration

**Environment:**
- Settings stored in Figma's `clientStorage` (user-scoped, persistent across sessions)
- No `.env` files required - API keys provided by users via UI
- Configuration keys stored in `package.json` under `figma-plugin` field

**Build:**
- `vitest.config.ts` - Test configuration with globals enabled, node environment, pattern `src/**/*.test.ts`
- Plugin manifest in `package.json`:
  ```json
  {
    "figma-plugin": {
      "editorType": ["figma"],
      "id": "description-generator",
      "name": "Description Generator",
      "menu": [
        {"name": "Current page", "main": {...}, "ui": "src/ui.tsx"},
        {"name": "All pages", "main": {...}, "ui": "src/ui.tsx"}
      ]
    }
  }
  ```

**TypeScript:**
- Extends `@create-figma-plugin/tsconfig`
- Type roots include `@figma` and `@types` from node_modules
- Excludes `.test.ts` files from compilation

## Platform Requirements

**Development:**
- Node.js with npm
- Figma desktop application for plugin development and testing
- Text editor/IDE with TypeScript support

**Production:**
- Figma desktop application or web (Figma's browser plugin support)
- Modern browser with fetch API support
- Figma account with plugin development enabled

**Plugin Deployment:**
- Built artifact: `build/` directory (git-ignored, generated during build)
- Distribution via Figma's Community plugin marketplace or private plugin installation

---

*Stack analysis: 2026-02-24*
