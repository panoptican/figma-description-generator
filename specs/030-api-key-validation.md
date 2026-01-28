# API Key Validation

## Priority
LOW

## Description
Validate API keys before use to catch configuration errors early. Currently users discover invalid keys only when generation fails.

## User Story
As a designer, I want the plugin to verify my API key when I enter it so that I know immediately if there's a problem rather than discovering it during generation.

## Acceptance Criteria
- [x] "Test" or "Validate" button next to API key field in settings
- [x] Validation makes lightweight API call to verify key works
- [x] Success shows green checkmark and "Valid" message
- [x] Failure shows red X and specific error (invalid key, expired, rate limited)
- [x] Validation is optional (user can save without validating)
- [x] Each provider has appropriate validation endpoint

## Technical Notes
- ChatGPT: Use models list endpoint (lightweight, no tokens used)
- Claude: Use messages endpoint with minimal prompt
- Gemini: Use models list endpoint
- Validation should timeout after 5 seconds
- Don't validate on every settings open (only on user request)

## Implementation Notes
- Validation service in `src/services/validation.ts` with `validateApiKey` function
- ValidationStatus type: 'idle' | 'validating' | 'valid' | 'invalid'
- "Validate" button added next to API key textbox in SettingsModal
- Green checkmark (IconCheckCircle32) shows for valid keys
- Red warning icon (IconWarning32) shows with specific error for invalid keys
- Validation status resets when provider or API key changes
- 5-second timeout using AbortController
- Tests in `src/services/validation.test.ts` (15 tests)

## Status: COMPLETE
