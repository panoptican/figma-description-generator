# Usage limits and Pro subscription

Handoff spec. Written September 9, 2026 so an implementer can build this without further input. Decisions in the "Locked decisions" section are final; do not re-open them. Anything in "Needs Jason" is blocked on the account owner and must be left as a clearly marked TODO, not guessed.

## Context

Description Generator is a Figma plugin (Preact + TypeScript, create-figma-plugin) that writes component descriptions with AI. Spec 058 moved generation to a publisher-managed Cloudflare Worker in `worker/` that holds the Gemini key and exposes `POST /generate` taking `{ prompt, imageBase64? }` and returning `{ description }`. The plugin client is `src/services/ai.ts`; the Worker is `worker/src/index.ts`; both have Vitest suites (`npm test` runs `src/**` and `worker/**`). The plugin's main thread is `src/main.ts`, the UI root is `src/components/App.tsx`, and main↔UI messaging uses typed `emit`/`on` handlers declared in `src/types.ts`.

Read `CLAUDE.md`, `AGENTS.md`, `specs/058-publisher-managed-generation.md`, and `worker/README.md` before starting. Match existing style: two-space indent, single quotes, no new dependencies, tests colocated as `*.test.ts`.

## Locked decisions

- Free tier: 1,000 descriptions per user, lifetime. Never resets.
- Pro tier: 10 US dollars per month through Figma Community payments, 10,000 descriptions per calendar month (UTC), resets on the first of each month. Annual plan at 20 percent off, which Figma computes as 96 dollars a year.
- The first resubmission ships as a paid plugin with the free tier built in. Do not build the transition-only fallback identity path.
- Trial users (Figma's default seven-day subscription trial) count as Pro.
- Both caps can be raised for an individual user only by a manual database edit. There is no self-serve path past 10,000.
- Identity and payment status come from Figma's payments API, verified server-side. The plugin never self-reports its plan.
- Every successful generation counts as one description, including icon-name generation and variants. Failed requests do not count.
- Existing per-IP rate limiting, input caps, and the Gemini configuration from spec 058 stay as they are.

## Architecture

```
Plugin UI ──(paymentToken + prompt)──▶ Worker /generate ──▶ Gemini
                                          │
                                          ├─▶ Figma REST /v1/payments (verify token, cached)
                                          └─▶ D1: users, token_cache
```

Flow per generation:

1. The UI asks the main thread for a payment token (`figma.payments.getPluginPaymentTokenAsync()` is main-thread only). The UI caches the token in memory for 5 minutes.
2. The UI posts `{ prompt, imageBase64?, paymentToken }` to the Worker.
3. The Worker resolves the token to `{ userId, plan }`: first from the `token_cache` table (10-minute TTL keyed by SHA-256 of the token), otherwise by calling Figma's payments endpoint and caching the result.
4. The Worker atomically checks the user's cap and increments their counter in one D1 statement. If the row does not update, respond 402 with usage details.
5. The Worker calls Gemini. On failure it decrements the counter it just incremented (best effort) and returns the existing error shape.
6. The Worker returns `{ description, usage }`.

## Figma payments facts (verified against docs on September 9, 2026)

- Manifest needs `"permissions": ["payments"]`. Add it under `figma-plugin` in `package.json`; the build regenerates `manifest.json`.
- `figma.payments.status.type` is `'UNPAID' | 'PAID' | 'NOT_SUPPORTED'`. `NOT_SUPPORTED` means the plugin is not published with payments (true in development and until Jason enables payments on publish). The creator always reads as `PAID` on a published plugin.
- `figma.payments.getPluginPaymentTokenAsync()` returns a short-lived opaque token identifying the current user for this plugin. Lifetime is not documented; treat it as minutes and refresh on a 401 from the Worker.
- `figma.payments.initiateCheckoutAsync({ interstitial: 'PAID_FEATURE' })` opens Figma's checkout. It throws in query mode and during widget rendering; neither applies here. Await it, then refresh token and usage.
- `figma.payments.setPaymentStatusInDevelopment({ type: 'PAID' })` changes the local `status` in development only. It is not known to affect what the REST endpoint reports; assume it does not.
- REST: `GET https://api.figma.com/v1/payments?plugin_payment_token=<token>` with header `X-Figma-Token: <personal access token belonging to the plugin's publisher>`. Rate limit 300 requests per minute. Response is a `PaymentInformation` object: `user_id` (string), `resource_id`, `resource_type` (`PLUGIN`), `payment_status` with a status of `UNPAID`, `PAID`, or `TRIAL`, and `date_of_purchase`. The docs are inconsistent about whether the status field is named `type` or `status`; read both and treat either as the value.
- Unverified: whether the endpoint returns a `user_id` for a user who has never paid or started a trial. The design assumes yes. If it returns an error for unpaid users, stop and raise it; see Needs Jason.

## Worker changes (`worker/`)

### Config

Add to `worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "description-generator", "database_id": "TODO_FROM_WRANGLER_D1_CREATE" }
],
"vars": {
  "FREE_LIFETIME_LIMIT": "1000",
  "PRO_MONTHLY_LIMIT": "10000"
}
```

New secret: `FIGMA_TOKEN` (publisher's personal access token). Set with `wrangler secret put FIGMA_TOKEN --config worker/wrangler.jsonc`. Document it in `worker/README.md` next to `GEMINI_API_KEY`.

Optional local-only var in `worker/.dev.vars`: `FAKE_PAYMENTS=1`. When set, a token of the form `dev:<userId>:<free|pro>` resolves without calling Figma. The code must refuse to honor this when `FAKE_PAYMENTS` is unset, and the README must say never to set it in production.

### Schema

Create `worker/schema.sql` and apply it with `wrangler d1 execute description-generator --config worker/wrangler.jsonc --remote --file worker/schema.sql` (and `--local` for dev):

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',          -- 'free' | 'pro'; refreshed on every verified lookup
  lifetime_count INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT '',             -- 'YYYY-MM' in UTC for period_count
  period_count INTEGER NOT NULL DEFAULT 0,
  free_limit_override INTEGER,                 -- manual override; NULL means use FREE_LIFETIME_LIMIT
  pro_limit_override INTEGER,                  -- manual override; NULL means use PRO_MONTHLY_LIMIT
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS token_cache (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  expires_at INTEGER NOT NULL                  -- unix seconds
);
```

### Modules

Split `worker/src/index.ts` so each piece is testable with a fake D1:

- `worker/src/identity.ts`: `resolveIdentity(token, env, now): Promise<{ userId, plan } | { error: 'invalid_token' | 'figma_unavailable' }>`. SHA-256 the token with `crypto.subtle`, look up `token_cache`, else call Figma, map `PAID`/`TRIAL` to `pro` and `UNPAID` to `free`, upsert the cache row with a 600-second TTL, and upsert `users` (insert if missing, else update `plan` and `updated_at`). A Figma 4xx on the token is `invalid_token`; 5xx or network failure is `figma_unavailable`. Honor `FAKE_PAYMENTS` here.
- `worker/src/quota.ts`: `reserve(db, userId, plan, limits, now)` runs one statement and returns `{ ok: true, usage }` or `{ ok: false, usage }`. Also `release(db, userId, plan, period)` for the failure path. Usage shape is defined in the contract below.
- `worker/src/index.ts`: routing, CORS, rate limit, validation, then identity → reserve → Gemini → release on failure → respond.

Reserve statement. `?1` is the current period `YYYY-MM`, `?2` is `updated_at`, `?3` is the user id, `?4` is 1 for pro and 0 for free, `?5` and `?6` are the configured limits:

```sql
UPDATE users SET
  period_count = CASE WHEN period = ?1 THEN period_count + 1 ELSE 1 END,
  period = ?1,
  lifetime_count = lifetime_count + 1,
  updated_at = ?2
WHERE user_id = ?3 AND (
  (?4 = 1 AND (CASE WHEN period = ?1 THEN period_count ELSE 0 END) < COALESCE(pro_limit_override, ?6))
  OR
  (?4 = 0 AND lifetime_count < COALESCE(free_limit_override, ?5))
)
RETURNING lifetime_count, period_count, free_limit_override, pro_limit_override;
```

If no row comes back, read the row without updating and respond 402. Use `.bind(...).first()` for RETURNING. D1 supports `RETURNING`.

Release statement (only after a Gemini failure that followed a successful reserve): decrement `lifetime_count` by 1 and `period_count` by 1 where `user_id = ? AND period = ?`, floored at zero.

### Endpoints and contract

`POST /generate`

Request: `{ prompt: string, imageBase64?: string, paymentToken: string }`. Missing or non-string `paymentToken` is a 400.

Success: `{ description: string, usage: Usage }`.

`Usage` is `{ plan: 'free' | 'pro', used: number, limit: number, period: string | null, resetsAt: string | null }`. For free, `used` is the lifetime count, `period` and `resetsAt` are null. For pro, `used` is the period count, `period` is `YYYY-MM`, and `resetsAt` is the ISO timestamp of the first of next month at 00:00 UTC. `limit` reflects overrides.

Errors keep the existing `{ error: string }` shape and add a `code` field:

- 401 `{ error: 'Your Figma session could not be verified. Reopen the plugin and try again.', code: 'invalid_token' }`
- 402 `{ error: <see copy below>, code: 'quota_exceeded', usage: Usage }`
- 503 `{ error: 'The generation service could not reach Figma. Try again in a moment.', code: 'figma_unavailable' }` with `Retry-After: 10`
- Existing 400/429/500/502 responses unchanged, with `code` values `bad_request`, `rate_limited`, `not_configured`, `upstream_error`.

402 copy: free users get `You've used all 1,000 free descriptions. Upgrade to Pro for 10,000 a month.` Pro users get `You've used this month's 10,000 descriptions. Your limit resets on <Month D>.` Substitute the real limit when an override applies.

`POST /usage`

Request: `{ paymentToken: string }`. Response: `{ usage: Usage }` or the 401/503 errors above. Does not count against quota. Same CORS and per-IP rate limit as `/generate`.

### Logging

Extend the existing `generate` log line with `plan` and `userId`. Never log the token, the prompt, or the description. Log `quota_exceeded` events with `userId` and `plan` so abuse is visible in `npm run worker:tail`.

## Plugin changes (`src/`)

### Manifest

In `package.json` under `figma-plugin`, add `"permissions": ["payments"]`. Rebuild and confirm `manifest.json` carries it.

### Main thread (`src/main.ts`, `src/types.ts`)

Add handlers:

- `GET_PAYMENT_TOKEN` → main calls `figma.payments.getPluginPaymentTokenAsync()` and emits `PAYMENT_TOKEN` with `{ token: string | null, status: 'UNPAID' | 'PAID' | 'NOT_SUPPORTED' }`. Wrap in try/catch; on any throw emit `{ token: null, status: figma.payments?.status?.type ?? 'NOT_SUPPORTED' }`.
- `START_CHECKOUT` → main awaits `figma.payments.initiateCheckoutAsync({ interstitial: 'PAID_FEATURE' })`, then emits `CHECKOUT_FINISHED` with `{ status }`. Catch and still emit so the UI never hangs.

Add the typed handler interfaces to `src/types.ts` following the existing naming (`GetPaymentTokenHandler`, `PaymentTokenHandler`, `StartCheckoutHandler`, `CheckoutFinishedHandler`).

### Service client (`src/services/ai.ts`)

- `GenerationInput` gains `paymentToken: string`. Send it in the body.
- Export a `fetchUsage(paymentToken, abortSignal?)` that posts to `/usage` (derive the URL from `GENERATION_ENDPOINT` by replacing the path) and returns `Usage`.
- Export the `Usage` type and a `QuotaExceededError extends Error` carrying `usage`. Throw it on 402 so the UI can render an upgrade prompt instead of a plain error. Throw a `TokenError` on 401 so the UI can refresh the token and retry once.
- Retry behavior from spec 058 (429 and 503 with Retry-After) stays. 401 and 402 are never retried inside the client.

### UI (`src/components/App.tsx`, `src/components/Header.tsx`, `src/components/ComponentRow.tsx`)

- On load, request a token, then call `fetchUsage` and store `usage` in state. If `status` is `NOT_SUPPORTED` and no token comes back, show the header pill as `Usage unavailable` and still allow generation attempts (the Worker decides).
- Keep the token in a ref with a timestamp; refresh when older than 5 minutes or when the client throws `TokenError` (then retry the generation once).
- After every successful generation, update `usage` from the response.
- Header: add a compact pill left of the Settings button. Free: `412 / 1,000 free` with an `Upgrade` link. Pro: `1,204 / 10,000 this month`. Use existing header typography and `--figma-color-*` tokens; keep the header height unchanged. The pill's `title` explains the plan and, for Pro, the reset date.
- Quota exceeded: show the 402 message as the row error (existing `rowErrors` path) and add an `Upgrade to Pro` button in the row error area for free users. Both the pill link and the button emit `START_CHECKOUT`. On `CHECKOUT_FINISHED`, refresh token and usage, and clear the quota error so the user can retry. During a batch, a 402 stops the batch (treat like cancel), keeps already-applied results, and shows the message once in the header rather than on every remaining row.
- Settings Preferences copy: append a sentence that the service counts descriptions per Figma user for the free and Pro limits.

### No fallback identity

The plugin launches paid, so every published user has a payments token. Do not accept a self-reported Figma user ID. In development, `figma.payments.status.type` is `NOT_SUPPORTED`; use `FAKE_PAYMENTS` on the local Worker for testing, and show `Usage unavailable` in the pill when no token comes back.

## Docs to update

- `worker/README.md`: D1 create and schema steps, `FIGMA_TOKEN` secret, `FAKE_PAYMENTS` for local dev, the manual override command (`wrangler d1 execute description-generator --config worker/wrangler.jsonc --remote --command "UPDATE users SET pro_limit_override = 25000 WHERE user_id = '<id>'"`), and how to read a user's usage.
- `PRIVACY.md`: the service now stores the Figma user ID, plan, counts, and timestamps; Figma handles payment details and the plugin never sees card data; the token cache holds a hash of a short-lived token. Bump the effective date and mark as pending publisher approval.
- `README.md`: one paragraph on free and Pro limits.
- `release/community-listing.md`: pricing paragraph (free 1,000 lifetime, Pro 10 dollars a month or 96 dollars a year, 10,000 a month).
- `release/qa-checklist.md`: new "Limits and payments" section: usage pill on first launch, count increments, cap hit at a seeded low override, upgrade flow in development with `setPaymentStatusInDevelopment`, monthly reset by editing `period`, token refresh after 401, and the manual override.
- `CLAUDE.md`: settings and architecture sections mention D1 and the payments permission.
- Update spec 058's status to note this spec supersedes its "public endpoint" wording.

## Tests (no new dependencies)

Write a small in-memory fake of the D1 surface used (`prepare(sql).bind(...args).first()/run()/all()`) in `worker/src/testing/fakeD1.ts`. It only needs to recognise the handful of statements this feature issues; keying on a substring of the SQL is acceptable.

Worker:

- identity: cache hit skips Figma; cache miss calls Figma with `X-Figma-Token` and never logs the token; `PAID` and `TRIAL` map to pro, `UNPAID` to free; 4xx → `invalid_token`; 5xx → `figma_unavailable`; `FAKE_PAYMENTS` tokens resolve only when the var is set.
- quota: free user at 999 succeeds and at 1,000 fails with 402 and correct usage; pro user resets when the period changes; overrides take precedence; release after Gemini failure restores counts; concurrent reserves never exceed the limit (simulate by calling reserve in a loop against the fake).
- routing: missing `paymentToken` is 400; `/usage` returns usage without incrementing; 402 body carries `code` and `usage`; Gemini failure after reserve triggers release.

Plugin:

- `ai.test.ts`: token is sent; 402 throws `QuotaExceededError` with usage; 401 throws `TokenError`; neither is retried; `fetchUsage` posts to `/usage`.
- `main.test.ts`: `GET_PAYMENT_TOKEN` emits the token and status, and a throwing payments API still emits `{ token: null }`; `START_CHECKOUT` emits `CHECKOUT_FINISHED` even when checkout throws.
- `ComponentRow.test.ts` or a new `App`-level test following the existing hook-mocking pattern: a quota error renders the upgrade action for free users and not for pro.

Keep the existing 163 tests green. Update the manifest allowlist test if the endpoint constant moves.

## Verification the implementer can do alone

1. `npm test` and `npm run build` pass.
2. `wrangler deploy --config worker/wrangler.jsonc --dry-run` succeeds and lists the D1 and rate-limit bindings.
3. With `worker/.dev.vars` containing `GEMINI_API_KEY` (if available) and `FAKE_PAYMENTS=1`, run `npm run worker:dev`, apply the schema with `--local`, then curl `/usage` and `/generate` with `dev:tester:free` and `dev:tester:pro` tokens. Seed `free_limit_override = 2` for `tester` and confirm the third call returns 402 with the right copy.
4. Load the plugin in Figma development mode pointed at the local Worker (temporarily change `GENERATION_ENDPOINT` and the allowlist to `http://localhost:8787`, and revert before finishing). Confirm the pill, a count increment, and the 402 upgrade prompt. `initiateCheckoutAsync` in development shows Figma's dev interstitial; that is enough to prove the wiring.

Record what was verified and what was not in this file's Verification section, in the style of spec 058.

## Needs Jason (leave as TODO, do not guess)

- Create the D1 database: `wrangler d1 create description-generator` and paste the `database_id` into `worker/wrangler.jsonc`. Apply `worker/schema.sql` with `--remote`.
- Create a Figma personal access token and set `FIGMA_TOKEN`. If the payments endpoint returns 403, the token needs whatever scope Figma currently attaches to payments; check the token's scope list when creating it.
- Confirm the payments endpoint returns a `user_id` for an unpaid user. If it does not, free users cannot be identified without a self-reported ID; stop and raise it rather than building one.
- Stripe payout account in a supported country, connected through Figma's seller setup.
- Publish settings: subscription, 10 dollars per month, seven-day trial (default), yearly discount toggle on at 20 percent (96 dollars a year). Once published as paid it cannot be made free again, and monthly price rises are limited to 50 percent once per 30 days.
- Approve the revised `PRIVACY.md` and update the Community form.

## Out of scope

- Team or organization plans, seat sharing, or any billing outside Figma.
- Self-serve raises above the Pro cap.
- Usage analytics beyond what `wrangler tail` and a D1 query provide.
- Refund handling; Figma owns it.

## Verification

- `npm test` passes: 182 tests across 13 files, including identity, quota, rollback, routing, service errors, and payment handlers.
- `npm run build` passes and regenerates `manifest.json` with `permissions: ["payments"]`.
- `npx tsc -p worker/tsconfig.json --noEmit` passes.
- `wrangler deploy --config worker/wrangler.jsonc --dry-run` bundles successfully and lists the D1 and rate-limit bindings. Wrangler also reports a local log-file permission warning in this environment; the dry run still completes.
- Not verified: a live D1 database, remote schema application, `FIGMA_TOKEN`, live Figma payments responses, checkout in Figma, or a real Gemini generation. Those remain in Needs Jason.

## Status: IMPLEMENTED, AWAITING PUBLISHER SETUP
