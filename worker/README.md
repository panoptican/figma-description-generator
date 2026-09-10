# Generation service

A Cloudflare Worker that holds the Gemini API key, verifies Figma payment tokens, and forwards plugin requests to Gemini 3.5 Flash-Lite. The plugin never sees the key or payment details.

## One-time setup

You need a Cloudflare account, `wrangler` on your PATH, a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey), and a Figma personal access token with access to the payments endpoint.

1. Sign in once if you have not already:

   ```bash
   wrangler login
   ```

2. Create the D1 database, then paste its `database_id` into `worker/wrangler.jsonc` in place of `TODO_FROM_WRANGLER_D1_CREATE`:

   ```bash
   wrangler d1 create description-generator
   ```

   Apply the schema locally while developing and remotely before production traffic:

   ```bash
   wrangler d1 execute description-generator --config worker/wrangler.jsonc --local --file worker/schema.sql
   wrangler d1 execute description-generator --config worker/wrangler.jsonc --remote --file worker/schema.sql
   ```

3. Deploy the Worker. The output ends with its URL, shaped like `https://description-generator.<your-subdomain>.workers.dev`:

   ```bash
   npm run worker:deploy
   ```

4. Store the Gemini key as a secret. Paste it at the prompt; it is encrypted and never written to the repo:

   ```bash
   wrangler secret put GEMINI_API_KEY --config worker/wrangler.jsonc
   ```

   Store the publisher's Figma personal access token the same way:

   ```bash
   wrangler secret put FIGMA_TOKEN --config worker/wrangler.jsonc
   ```

5. Point the plugin at the deployed URL in two places, then rebuild:
   - `GENERATION_ENDPOINT` in `src/services/ai.ts` (keep the `/generate` path)
   - `figma-plugin.networkAccess.allowedDomains` in `package.json` (origin only, no path)

   A unit test fails if the two drift apart. Run `npm test && npm run build` afterwards.

6. Smoke-test from the terminal before opening Figma. Payment tokens are short-lived and normally come from the plugin:

   ```bash
   curl -s -X POST https://description-generator.<your-subdomain>.workers.dev/usage -H 'Content-Type: application/json' -d '{"paymentToken":"<token>"}'
   ```

   A successful response contains the user's current usage. `/generate` accepts the same `paymentToken` plus the prompt and returns the description and updated usage.

## Day to day

- Run `npm test -- worker/src` and `npx tsc -p worker/tsconfig.json` after Worker changes. Tests use Node 24's built-in SQLite to execute `schema.sql` and the real D1 queries; only HTTP requests are faked. Reservation failures restore both applicable counters, including across plan changes and month rollover.

- `npm run worker:dev` runs the Worker locally at `http://localhost:8787`. Put `GEMINI_API_KEY=...` and `FAKE_PAYMENTS=1` in `worker/.dev.vars`; fake tokens such as `dev:tester:free` and `dev:tester:pro` work only when this local-only variable is set. Never set `FAKE_PAYMENTS` in production.
- Apply the local schema before the first request: `wrangler d1 execute description-generator --config worker/wrangler.jsonc --local --file worker/schema.sql`.
- `npm run worker:tail` streams live logs. Each generation logs token counts only, never prompt or description text.
- Redeploy with `npm run worker:deploy` after editing `worker/src/index.ts`.

## Abuse and cost controls

- The Worker allows 60 requests per minute per client address. The plugin retries on the `Retry-After` header, so large batches slow down rather than fail.
- Prompts are capped at 24,000 characters and images at 6 MB of base64. Output is capped at 256 tokens.
- Set a budget alert on the Google Cloud project that owns the key so a surprise never runs unnoticed.
- The endpoint is public by design because the plugin runs in a sandboxed iframe with no origin to check. If abuse ever shows up in the logs, the quickest lever is tightening the rate limit in `worker/wrangler.jsonc` and redeploying.

## Limits and manual support

Free users receive 1,000 descriptions for the lifetime of their Figma account. Pro costs $10 per month, or $96 per year, and includes 10,000 descriptions per UTC calendar month. Trials count as Pro. Counts include icon names and variants; failed Gemini requests are released and do not count.

To inspect a user's usage:

```bash
wrangler d1 execute description-generator --config worker/wrangler.jsonc --remote --command "SELECT user_id, plan, lifetime_count, period, period_count, free_limit_override, pro_limit_override, updated_at FROM users WHERE user_id = '<id>'"
```

Manual overrides are the only way to raise an individual cap:

```bash
wrangler d1 execute description-generator --config worker/wrangler.jsonc --remote --command "UPDATE users SET pro_limit_override = 25000 WHERE user_id = '<id>'"
```
