# Release QA checklist

Run this against the final rebuilt plugin in a disposable Figma file. Record pass, fail, or blocked for each check; unchecked items are unverified. Record the build date, Figma client/version, OS, scope, and the deployed service URL. Capture screenshots of failures without confidential designs.

## Automated checks

Use the pinned Node 24 runtime.

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Review `npm audit` and `npm audit --omit=dev`; record unresolved findings separately from build success.
- [ ] The generated `manifest.json` keeps the Figma-assigned plugin ID, includes `documentAccess: "dynamic-page"`, and restricts network access to the single generation-service host.
- [ ] `wrangler deploy --config worker/wrangler.jsonc --dry-run` succeeds and lists the rate-limit binding.

## Prepare the file

- [ ] Include multiple pages, an empty page, standalone components, and a set with several variants.
- [ ] Include blank, whitespace-only, and existing descriptions.
- [ ] Include an `Icons` page, an ordinary component page, and an `Iconography` page to check icon detection boundaries.
- [ ] Import the built plugin from the root `manifest.json` and reopen after rebuilding.

## Launch and dynamic page loading

- [ ] Generation controls are enabled on first launch with no setup step.
- [ ] This page on the empty page shows the empty state.
- [ ] This page lists only the active page. Switching pages refreshes the inventory automatically.
- [ ] Reopen the Figma file, then launch Entire file before visiting other pages. Components on previously unloaded pages appear.
- [ ] Click a component name on a different page. Navigation, selection, and viewport focus succeed.
- [ ] Generate and manually edit a component on a previously unloaded page. Inspect its actual Figma description field to confirm writes succeed.
- [ ] Delete a listed component in Figma, then try its row action before rescanning. A missing node produces a recoverable result without leaving the plugin stuck.

## Settings and header regressions

- [ ] Expand several rows, then repeatedly open and close Settings with Save, Cancel, close button, and Escape. The dialog appears consistently and rows do not unexpectedly collapse.
- [ ] Saved prompts and preferences survive reopening. Cancel and Escape discard unsaved modal changes.
- [ ] Settings has only Preferences and Prompts tabs; no provider, key, or model controls remain anywhere in the UI.
- [ ] Install over a build that saved an API key (or seed one in clientStorage), launch, and confirm the stored settings no longer contain `apiKey`, `provider`, or `models`.
- [ ] Preferences copy explains what is sent to the service, immediate application, and the icon image exception.
- [ ] Rescan icon renders correctly in light and dark themes. Add, rename, and delete a component; rescan updates the inventory without duplicates.
- [ ] Header layout remains usable after export removal. No CSV/JSON export action or modal is present.

## Limits and payments

- [ ] On first launch, the usage pill shows the current free or Pro usage; in development with no payments token it says Usage unavailable.
- [ ] A successful description, icon-name generation, and variant generation each increment usage once; a failed request does not.
- [ ] Seed a low free limit override and confirm the cap returns 402, shows the exact free-tier copy, and offers Upgrade to Pro in the row error area.
- [ ] Confirm a Pro user sees the monthly count, reset date, and the cap message at the seeded monthly limit.
- [ ] In development, use `figma.payments.setPaymentStatusInDevelopment({ type: 'PAID' })` and the checkout action; confirm the token and usage refresh after checkout.
- [ ] Edit a Pro user's `period` to the previous month and confirm the next generation starts a new monthly count.
- [ ] Force a Worker 401 and confirm the plugin refreshes its token and retries once; a second 401 is shown as an error.
- [ ] Run the documented manual override and usage queries from `worker/README.md`; confirm the returned pill and cap reflect the override.

## Generation service and images

Run against the deployed Worker with the Gemini secret set. Calls incur Gemini charges on the publisher's key.

- [ ] Generate a real description in This page and Entire file.
- [ ] With images off and icon mode off, text-only generation succeeds.
- [ ] With images on, generation succeeds for a component with distinctive visual content. Inspect the request in the developer tools if needed to confirm an image was attached.
- [ ] With images off and icon mode on, an image is still attempted and the icon naming prompt is used.
- [ ] Disconnected network and a stopped or misconfigured Worker (secret removed) produce readable errors, clear loading states, preserve existing descriptions, and allow retry.
- [ ] Run a batch large enough to hit the per-address rate limit (more than 60 requests in a minute). Rows wait and complete rather than failing; `npm run worker:tail` shows 429s followed by successes.
- [ ] `npm run worker:tail` shows token counts per request and never prompt or description text.
- [ ] A very long custom prompt or an oversized image returns the service's validation message without a crash.

## Descriptions, sets, and batches

- [ ] Generate a standalone component. Its description is immediately applied in Figma, with no separate approval step.
- [ ] Generate a set alone, then the set and its variants. Verify correct parent context, variant properties, destinations, and no duplicate work.
- [ ] Bulk Fill preserves existing text and fills blanks, including whitespace-only descriptions.
- [ ] Enable overwrite: bulk Replace updates eligible descriptions. Individual and set generation replace their targeted descriptions regardless of the bulk toggle.
- [ ] Edit a description and wait for autosave; inspect the Figma field. Repeat while immediately collapsing or filtering out the edited row.
- [ ] Revert restores the previous value in both the row and the Figma field. Reverting again toggles back.
- [ ] Run at least three independent batches, including a variant set. Progress completes and no description or image is assigned to the wrong component.
- [ ] Stop remaining during a batch. Already-applied results remain; late responses do not apply more descriptions. A subsequent run succeeds.
- [ ] Toggle the Icon override, close and reopen, and confirm persistence. Automatic detection matches Icons and ordinary icon names without treating Iconography as an icon page.

## Search, shortcuts, and presentation

- [ ] Search and show-variants filtering preserve expected component/set targeting and counts.
- [ ] Generate, bulk generation, search, and revert shortcuts work. Typing in a text field does not trigger component generation or plugin-level revert.
- [ ] With Settings open and a button focused, try generation, revert, and search shortcuts. They should not operate on the obscured component list; record any background action as a failure.
- [ ] Escape closes Settings and row expansion appropriately; it does not stop a running batch.
- [ ] Light/dark themes, scrolling, focus, labels, and modal buttons remain legible and usable with a larger file.
- [ ] Capture listing screenshots from this verified build.

## Submission readiness

- [ ] Review `community-listing.md` against the verified behavior and screenshots.
- [ ] Publisher approves the revised `../PRIVACY.md` describing the publisher-managed service.
- [ ] Publish the approved policy and verify its public URL while signed out.
- [ ] Verify the public support URL while signed out. Do not include secrets or private designs in public issues.
- [ ] Confirm publisher identity, account prerequisites, Figma-assigned plugin ID preserved in build configuration, and current submission form requirements.
- [ ] Complete the form and verify In review separately from local QA. Published is a separate approval state.

## Settings details

- [ ] Reset Settings opens confirmation; Keep settings and Escape preserve settings. Confirming restores default preferences, prompts, and icon overrides without changing component descriptions. Reopen the plugin to verify persistence.

- [ ] Turn Show variants in list off: Fill/Replace counts exclude variants, generation changes only sets and standalone components, and Generate all descriptions is hidden. Turn it on: variants return to counts and generation.
