# PR #2 review follow-up

Scope: address the five inline findings on review `5170008936`. Preserve the publisher-managed service, existing free/Pro limits, and row/set replacement versus page/file Fill target selection. No database migration or production dependency is needed. Node 24 type declarations are a development dependency for the SQLite test adapter.

## Worker

- Quota reservations retain the actual accounting period separately from the public usage object. Rollback always restores the lifetime count and restores the monthly count only when that period is still current.
- `withReservation` owns reserve, generation, usage read, and failure cleanup. Gemini parsing lives in an adapter without database access. The HTTP boundary maps typed failures and returns structured errors for unexpected failures. Failed cleanup emits a safe operational event.
- Tests execute `schema.sql` and production statements through Node 24 SQLite. The former JavaScript quota implementation in `FakeD1` is removed. This supersedes spec 059's fake-D1 testing approach.

## Payments

- `createPaymentSession` owns token caching, usage reads, generation-result usage, and the single retry after an invalid token. Checkout starts a new identity session and aborts the preceding refresh; token replies carry request IDs so delayed main-thread replies cannot satisfy a newer request.
- Usage publication ignores older identity sessions and pre-generation reads. Loading, ready, unavailable, and error are explicit header states. Concurrent 401 responses share the first refresh.

## Generation

- All row, set, page, and file actions submit `GenerationBatch` objects to one runner. It owns pending component IDs, the synchronous busy guard, three concurrent batch slots, sequential set members, cancellation, result application, and quota/error outcomes. Overlapping starts share the active run rather than scheduling a second run for the same component.
- Explicit row/set actions replace descriptions. Page/file Fill continues to use the existing target-selection helper and skips existing descriptions. The row receives progress and errors from the runner; its duplicate generation/apply/error paths are removed.
- Image replies carry request IDs and time out after 30 seconds. Image and payment requests share a small host-message transport with one listener per reply type, so late replies after cancellation or timeout are ignored safely. Closing the UI cancels pending requests and removes listeners.

## Verification

- Worker changes: 194 tests pass across 13 files (31 Worker tests), the plugin build and Worker TypeScript check pass. Regressions cover free failure followed by upgrade, month rollover, concurrent caps, malformed upstream responses, usage-read failure, and failed-cleanup logging.
- Payment changes: 203 tests, plugin build, and Worker typecheck pass. Payment regressions cover out-of-order token/usage replies, checkout during generation, concurrent token failures, unavailable/error states, expiry, and disposal.
- Live Figma payment and production service verification remain separate publisher setup work.

- Final regression suite: 215 tests across 16 files. Plugin build and Worker TypeScript check pass.
- Headless Chromium loaded the actual `build/ui.js` in a fixture with simulated Figma and service responses. Assertions cover shared row/set/page busy controls, cancellation and late image replies, exactly-once set application, page/file Fill selection, quota upgrade feedback, checkout clearing errors, Pro usage, late token replies, and no page errors. Two usage reads occurred: initial identity and checkout.
- Browser script, fixture, results, and screenshots are archived locally under `logs/process-archive/2026-09-10/pr2-review-fixes/`, with capture provenance. These are browser fixtures, not live Figma captures.

## UI follow-up

- Usage now shares the refresh/settings control geometry: 32px high with 6px corners. The header background mixes 6% of Figma's foreground into the row surface, making it lighter in dark mode and darker in light mode; its divider uses the normal border token. The built-plugin color check passed at 400px and 672px, with secondary-text contrast of 4.64:1 in the light fixture and 4.79:1 in the dark fixture.
- The page row and component-set heading form a sticky stack. Expanded set editors scroll away while their compact headings stay visible. Each heading is bounded by its group, so the next set or page replaces it. Search results that only match variants retain sticky parent context.
- The chosen right-side count-and-chevron control replaces the separate Variants sub-row. It controls only variant visibility; set editing remains a separate action. Hidden variant editors stay mounted so pending autosaves and drafts survive.
- Verification: 215 tests and the plugin build pass. The built plugin was exercised in a browser fixture with 32- and 16-variant sets, multiple pages, light/dark themes, and 400px/672px widths. Checks cover sticky positions, collapsing while scrolled, keyboard disclosure, exactly-once draft autosave, and no horizontal overflow or page errors. Live Figma rendering remains a separate manual check.
- Source screenshot, browser fixtures, captures, results, and provenance are archived locally under `logs/process-archive/2026-09-10/pr2-ui-followup/`. Only the selected synthetic fixture screenshot is included on the PR.

## Variant generation and hierarchy follow-up

- Every expanded variant has Generate description / Regenerate and Revert controls. Generation uses that variant's own image when enabled (or required by icon mode), plus the complete set's variant names as text. Sibling images are never exported for an individual request. Icon prompts now retain the same sibling context; repeated parsed properties are omitted from the context list.
- The parent has a split button: its primary action generates the parent description only; the disclosure offers Set + N variants and shows the description count and replacement behavior. The existing full-set flow remains sequential, exporting each member's own image for its own request when image sending is enabled. This is one user action, not a multi-image provider request.
- Successful generation starts a two-second guard for that component, held in the App so filtering, collapsing, and keyboard shortcuts cannot bypass it. Any row/set/page/file action that would repeat a cooling-down target waits until its control is available; unrelated rows remain available. Failed requests do not start a cooldown. The button briefly reads Generated, then Regenerate, while a text status remains visible. Editing or reverting clears the generated status.
- Left insets are 16px for the page disclosure, 36px for components and set parents, and the existing 56px for variants. Expanded editors and sticky headings share those offsets.
- Verification: 222 tests across 16 files and the plugin build pass. Built-plugin browser fixtures verify selected-image-only requests with complete sibling names, image-off requests, full-set image/application counts, success and failure paths, keyboard and collapse/filter guards, manual-edit status clearing, split-button keyboard handling, sticky offsets, and light/dark layouts at 400px and 672px. These are simulated browser checks; live Figma QA remains separate.
- Sources, script, fixtures, screenshots, and request-count evidence are archived in `logs/process-archive/2026-09-10/pr2-variant-controls/` with provenance.

## Status: COMPLETE
