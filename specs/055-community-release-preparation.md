# Community release preparation

## Scope — 2026-09-04

The user requested subagents to remove the one-way description export, support Figma dynamic page loading, correct the Community listing, and prepare privacy/setup disclosures.

## Decisions

- Remove CSV/JSON description export. It downloaded only filtered, non-empty descriptions for external documentation and backups; spreadsheet import was never implemented. Keep PNG export used in AI requests.
- Preserve immediate application of generated descriptions and autosave of manual edits. Correct the listing and setup copy to describe this behavior.
- Declare dynamic page access in the build configuration and migrate scanning, node lookup, and page selection together. Ignore stale asynchronous scan results.
- Draft a repository privacy policy from the actual implementation. Publisher approved the policy on September 4, 2026; public availability remains a separate release check.
- Explain provider API accounts, potential charges, direct requests, and icon image behavior in Settings as well as release documentation.

## Verification

- `npm test`: 116 tests across nine files passed under Node 24.12.0. This includes ten new dynamic-page tests; 29 tests for the removed CSV/JSON feature were retired with that feature.
- `npm run build`: typecheck and production bundle passed; generated manifest includes `documentAccess: "dynamic-page"` and the three existing provider domains.
- Non-blocking tool warnings remain: Vite config-loader compatibility warning and outdated Browserslist data. A worker's standalone `tsc --noEmit` encountered the known Figma/DOM declaration overlap; the supported project build passed.
- Source review confirmed removal of the description export action and preservation of PNG export for AI requests. Settings disclosures were reviewed against request and storage code.
- The live walkthrough is maintained in `release/qa-checklist.md`; its unchecked items must not be treated as passed by automated validation. No live provider calls or Figma interaction tests were performed in this change.

## Remaining release work

### Follow-up — economical models and GLM

Switched OpenAI to `gpt-5.4-nano` with reasoning disabled and Google to `gemini-2.5-flash-lite`; retained `claude-haiku-4-5`. Added the exact requested `z-ai/glm-5.3-flash` model through OpenRouter, including Settings, key validation, PNG input, cancellation, and readable API errors. OpenRouter is now in the generated network allowlist and the data-routing disclosures.

OpenRouter's public model metadata reported mandatory reasoning with low/high/max effort on 2026-09-04. The client requests low effort with a 4,096-token total response limit, excludes reasoning from the response, and rejects empty or truncated answers. Validation uses the authenticated `/api/v1/key` endpoint without a model call. Official references: https://openrouter.ai/z-ai/glm-5.3-flash and https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key.

Validation: 132 tests in ten files passed; production build and typecheck passed. The manifest contains all four API hosts. No authenticated provider calls were made; the user will test model quality and live access in Figma.

### Follow-up — shortcut isolation and listing voice

Settings now pauses background generation, search, and revert shortcuts while preserving Escape and native text editing. Four regression cases exercise the registered shortcut listener with Cmd/Ctrl, modal focus, Escape, text undo, and normal commands with Settings closed. Final validation: 120 tests across nine files and the supported production build passed. Live Figma interaction remains unchecked.

Community copy was revised with the jason-voice skill into four direct paragraphs, preserving application, overwrite, API account/charges, image, and data-transfer disclosures. A public GitHub-rendered privacy file is the planned link destination; it still needs publication and a signed-out availability check.

Run live QA in Figma after rebuilding, including the existing Rescan/Settings regressions and real provider requests. Publish the approved privacy policy and review the corrected listing. Confirm the assigned Figma plugin ID, support URL, publisher setup, and submission state separately. Development dependency audit remediation is outside this change.

## Status: COMPLETE
