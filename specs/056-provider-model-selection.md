# Provider model selection

## Request

Make OpenRouter a provider rather than a single-model option. Each provider should have a default model and a dropdown so users can select newer models without a plugin release.

## Behavior

- OpenAI, Anthropic, Google, and OpenRouter have independent saved model selections. Existing settings continue using GPT-5.4 nano, Claude Haiku 4.5, Gemini 2.5 Flash-Lite, and `z-ai/glm-5.3-flash` respectively.
- Settings fetches catalogs only when Refresh model list is clicked. Catalogs support pagination where the API requires it. The separate filter field was removed during Settings refinement. A custom model-ID option covers unlisted models. Defaults and saved selections remain available if loading fails.
- OpenRouter catalog browsing is public and does not transmit a key. Other catalogs use the selected provider's key. Keys are isolated while switching provider drafts; only the active provider's key is saved, matching the existing storage scope.
- Generation uses the selected model. OpenRouter capability metadata prevents known unsupported image requests and selects the lowest advertised mandatory reasoning effort. Optional reasoning is disabled. Unknown custom models use API defaults; endpoint-specific compatibility remains a live QA responsibility.
- Anthropic validation uses its authenticated model-list endpoint, so validation no longer generates a billable test message. Privacy, listing, setup, and QA documentation describe catalog requests and model selection.
- Catalogs refresh on demand; the plugin does not silently upgrade a user's selected model. New model-specific API requirements can still require an adapter update.

## Verification

- 149 tests across eleven files pass, including catalog normalization, pagination, default migration, selected model requests, image restrictions, reasoning metadata, failures, cancellation, and truncated output.
- Production build and typecheck pass under Node 24.12.0.
- Headless Chromium check of the actual built UI passed with simulated catalogs: 120 models, filtering, selection, custom IDs, reopening saved selections, independent per-provider choices, Cancel, and key isolation. Screenshots inspected at 960×800. Temporary harness and screenshots: `/tmp/description-generator-model-qa/`. The browser required running outside the sandbox because macOS blocked its process port; no authenticated provider calls were made.
- Live Figma/provider calls remain for user testing. Build warnings remain limited to the existing outdated Browserslist data and Vite config-loader warning during tests.

## API references

- https://developers.openai.com/api/reference/resources/models/methods/list
- https://platform.claude.com/docs/en/api/models/list
- https://ai.google.dev/api/models
- https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties

## Status: COMPLETE
