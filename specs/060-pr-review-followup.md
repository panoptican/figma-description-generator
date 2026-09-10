# PR #2 review follow-up

Scope: address the five inline findings on review `5170008936`. Preserve the publisher-managed service, existing free/Pro limits, and row/set replacement versus page/file Fill target selection. No database migration or production dependency is needed. Node 24 type declarations are a development dependency for the SQLite test adapter.

## Worker

- Quota reservations retain the actual accounting period separately from the public usage object. Rollback always restores the lifetime count and restores the monthly count only when that period is still current.
- `withReservation` owns reserve, generation, usage read, and failure cleanup. Gemini parsing lives in an adapter without database access. The HTTP boundary maps typed failures and returns structured errors for unexpected failures. Failed cleanup emits a safe operational event.
- Tests execute `schema.sql` and production statements through Node 24 SQLite. The former JavaScript quota implementation in `FakeD1` is removed. This supersedes spec 059's fake-D1 testing approach.

## Payments

- `createPaymentSession` owns token caching, usage reads, generation-result usage, and the single retry after an invalid token. Checkout starts a new identity session and aborts the preceding refresh; token replies carry request IDs so delayed main-thread replies cannot satisfy a newer request.
- Usage publication ignores older identity sessions and pre-generation reads. Loading, ready, unavailable, and error are explicit header states. Concurrent 401 responses share the first refresh.

## Remaining work

- Route row, set, page, and file generation through one runner with shared component ownership and outcome handling.
- Complete regression checks and reply to all five PR comments with pushed commits.

## Verification

- Worker changes: 194 tests pass across 13 files (31 Worker tests), the plugin build and Worker TypeScript check pass. Regressions cover free failure followed by upgrade, month rollover, concurrent caps, malformed upstream responses, usage-read failure, and failed-cleanup logging.
- Payment changes: 203 tests, plugin build, and Worker typecheck pass. Payment regressions cover out-of-order token/usage replies, checkout during generation, concurrent token failures, unavailable/error states, expiry, and disposal.
- Live Figma payment and production service verification remain separate publisher setup work.

## Status: IN PROGRESS
