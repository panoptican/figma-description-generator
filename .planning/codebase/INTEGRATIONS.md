# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**AI Providers (User-Configurable):**
- OpenAI ChatGPT
  - What it's used for: Generate component descriptions and icon names
  - SDK/Client: Native `fetch()` implementation
  - Auth: Bearer token (user-provided API key)
  - Endpoint: `https://api.openai.com/v1/chat/completions`
  - Model: `gpt-4o-mini` (256 token max)
  - Image Support: Yes (base64 PNG)

- Google Gemini
  - What it's used for: Generate component descriptions and icon names
  - SDK/Client: Native `fetch()` implementation
  - Auth: Query parameter API key (user-provided)
  - Endpoints:
    - Generation: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
    - Validation: `https://generativelanguage.googleapis.com/v1beta/models`
  - Models: `gemini-1.5-flash` (with images), `gemini-pro` (text only)
  - Image Support: Yes (base64 PNG)

- Anthropic Claude
  - What it's used for: Generate component descriptions and icon names
  - SDK/Client: Native `fetch()` implementation
  - Auth: Custom header `x-api-key` (user-provided)
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Model: `claude-3-haiku-20240307` (256 token max)
  - Headers: Includes `anthropic-dangerous-direct-browser-access: true` for browser context
  - Image Support: Yes (base64 PNG)

**Validation Endpoints (Lightweight API Health Checks):**
- OpenAI: `GET https://api.openai.com/v1/models`
- Claude: `POST https://api.anthropic.com/v1/messages` (minimal request with max_tokens=1)
- Gemini: `GET https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}`

## Data Storage

**Databases:** None - Figma plugin has no persistent backend database

**Settings Storage:**
- **Provider:** Figma `clientStorage` (user-scoped storage)
- **Persistence:** Settings loaded via `loadSettingsAsync()`, saved via `saveSettingsAsync()`
- **Scope:** Per-user in Figma account
- **Stored Settings:**
  ```typescript
  {
    provider: 'chatgpt' | 'claude' | 'gemini',
    apiKey: string,
    customPrompt: string,
    customVariantPrompt: string,
    customIconPrompt: string,
    includeImage: boolean,
    showVariants: boolean,
    overwriteExisting: boolean,
    iconOverrides?: Record<string, boolean>
  }
  ```

**Component Data:**
- Source: Figma document (in-memory during session)
- Extracted via Figma Plugin API: `figma.root.children`, `figma.currentPage`, `node.findAllWithCriteria()`
- Persisted back to Figma: Via `node.description` property writes
- Cache Cleanup: Old `description-cache` removed on plugin init (migration from earlier versions)

**File Storage:** None - No file uploads or local storage

**Caching:**
- None active (caching systems removed in commit 424afab)
- Previous cache data (`description-cache`) cleaned up on initialization

## Authentication & Identity

**Auth Provider:** None - User-managed API keys

**Implementation:**
- Each AI provider requires user to supply their own API key
- Keys stored securely in Figma `clientStorage` (never logged or transmitted except to respective AI providers)
- Validation performed by making test calls to provider API endpoints
- No OAuth, no account creation, no authentication server
- Each provider uses its own auth mechanism (Bearer token, API key header, query param)

## Monitoring & Observability

**Error Tracking:** None

**Logs:**
- Approach: Native `console.error()` for failures
- Locations:
  - Image export failures: `src/main.ts` line 194
  - Generation failures: `src/components/App.tsx` lines 356, 399
- User-facing error messages displayed in component rows via `rowErrors` state
- No telemetry or error reporting to external service

## CI/CD & Deployment

**Hosting:** None - Plugin runs in user's Figma desktop/web instance

**CI Pipeline:** Not detected - No `.github/workflows` or CI configuration files found

**Build Pipeline:**
- Command: `npm run build` - Runs `build-figma-plugin --typecheck --minify`
- Watch mode: `npm run watch` - Incremental development builds
- Output: `build/` directory (git-ignored)
- TypeScript checking enabled by default

## Environment Configuration

**Required env vars:** None - No `.env` files used

**Secrets location:**
- API keys stored in Figma `clientStorage` (not in environment)
- No sensitive data in `.env` files
- Keys provided by users at runtime via Settings modal

**Configuration Access:**
```typescript
// In src/main.ts line 154:
const settings = await loadSettingsAsync(DEFAULT_SETTINGS)
```

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:**
- None to external services
- Internal event-based messaging via `@create-figma-plugin/utilities`:
  - `emit()` - Send messages from main plugin to UI
  - `on()` - Subscribe to messages from UI
  - Events defined in `src/types.ts` (LoadComponentsHandler, ApplyDescriptionHandler, etc.)

## API Rate Limiting & Quotas

**OpenAI:**
- Rate limit errors caught via HTTP 429 response
- Error handling in `src/services/validation.ts` line 120

**Claude:**
- Rate limit errors caught via HTTP 429 response
- Error handling in `src/services/validation.ts` line 140

**Gemini:**
- Rate limit errors caught via HTTP 429 response
- Error handling in `src/services/validation.ts` line 160

**Concurrency:**
- Max 3 concurrent API requests during "Generate All" operation
- Implemented via worker pool in `src/components/App.tsx` line 67, lines 375-376

## Data Transmission

**Image Data:**
- Components exported as PNG (1x scale) via Figma API
- Converted to base64 by `figma.base64Encode()` in `src/main.ts` line 188
- Sent in API request body only when `includeImage: true` or component is icon
- Image size not limited explicitly (managed by Figma's export constraints)

**Text Data:**
- Component names, properties, descriptions sent as plain text in prompts
- No encryption in transit (relies on HTTPS to respective API providers)

---

*Integration audit: 2026-02-24*
