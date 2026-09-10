# Publisher-managed generation

## Request

Figma rejected the Community submission on September 9, 2026: plugins that let users bring their own API key for other model providers are not approved. Feedback: remove the BYOK requirement, switch to a publisher-managed AI flow, and resubmit. Figma confirmed the plugin is approvable after that change.

## Behavior

- Generation runs through a Cloudflare Worker in `worker/` that holds the Gemini API key as a secret and calls `gemini-2.5-flash-lite` with thinking disabled and a 256-token output cap. The plugin posts `{ prompt, imageBase64? }` to `POST /generate` and receives `{ description }`.
- The plugin has no provider, API key, model selection, key validation, or catalog code. Settings keeps Preferences and Prompts. The header setup banner and every "add an API key" gate are gone; generation controls are always enabled.
- Loading settings strips `provider`, `apiKey`, `models`, `enableFallback`, and `providerChain` and rewrites storage when any were present, so keys saved by earlier builds are purged on first launch.
- The manifest allowlists only the service origin. `GENERATION_ENDPOINT` in `src/services/ai.ts` and `networkAccess.allowedDomains` in `package.json` must agree; a unit test enforces it. The Figma-assigned plugin ID now lives in `package.json` so rebuilds preserve it.
- The Worker rate-limits 60 requests per minute per client address and answers 429 with `Retry-After`. The plugin client retries up to twice on 429 or 503, honoring `Retry-After` up to 15 seconds and aborting cleanly on cancel, so batches at concurrency 3 self-pace instead of failing.
- The Worker validates input (prompt up to 24,000 characters, base64 image up to 6 MB), maps upstream failures to readable messages without leaking Google error text, and logs token counts only.
- Cost reference from the planning discussion: about 1 to 2 dollars per 10,000 image requests on the paid Gemini tier, versus 4 to 15 dollars for GLM 5.3 Flash because of its mandatory reasoning tokens.

## Setup

`worker/README.md` covers deploy, secret, endpoint wiring, smoke test, local dev, and the cost controls. The endpoint in the repo is a placeholder until the Worker is deployed and its URL is pasted into the two locations above.

## Verification

- 163 tests pass across 11 files, including the new Worker suite (CORS, validation, missing secret, Gemini request shape, rate limit, error mapping, content-free logging), the service client (request shape, image, abort, error surfacing, Retry-After retry, retry exhaustion, cancel during wait), the manifest allowlist test, and the settings migration.
- Production typecheck and build pass. `wrangler deploy --dry-run` bundles the Worker and lists the rate-limit binding.
- Not yet verified: a live deploy, a real Gemini call, and the Figma checks in `release/qa-checklist.md`. The privacy policy revision needs publisher approval before the listing form is updated.

Spec 059 supersedes this spec's description of the endpoint as public and adds server-side Figma identity, payments, and usage limits.

## Status: IMPLEMENTED, AWAITING DEPLOY; superseded by spec 059 for identity, payments, and usage limits
