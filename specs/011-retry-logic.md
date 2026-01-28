# Retry Logic for API Failures

## Priority
MEDIUM

## Description
Implement automatic retry with exponential backoff when AI API requests fail. Currently failures are shown to the user but not automatically retried, requiring manual intervention.

## User Story
As a designer, I want failed description generations to automatically retry so that temporary API issues don't interrupt my workflow.

## Acceptance Criteria
- [x] Failed API requests automatically retry up to 3 times
- [x] Retry uses exponential backoff (1s, 2s, 4s delays)
- [x] Retryable errors identified (rate limits, timeouts, 5xx errors)
- [x] Non-retryable errors fail immediately (auth errors, invalid requests)
- [x] UI shows retry status ("Retrying... attempt 2/3")
- [x] User can cancel ongoing retries
- [x] After max retries, show final error with option to retry manually

## Technical Notes
- Wrap AI service calls with retry utility
- Rate limit errors (429) should respect Retry-After header if present
- Network errors and timeouts are retryable
- 4xx errors (except 429) are not retryable
- Consider circuit breaker pattern if provider is consistently failing

## Implementation Notes
- Retry utility in `src/utils/retry.ts` with `withRetry` function
- `isRetryableError` identifies retryable vs non-retryable errors
- `calculateDelay` implements exponential backoff (1s, 2s, 4s)
- `getRetryAfterMs` respects Retry-After header in error messages
- AI service uses `generateDescriptionWithRetry` for retry support
- UI displays retry status via `retryStatus` prop on ComponentRow
- Cancel functionality via `shouldAbort` callback and `abortRetryRef`
- Tests in `src/utils/retry.test.ts` (28 tests)

## Status: COMPLETE
