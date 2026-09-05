# Settings refinement

Completed September 4, 2026.

- Keep Setup and Prompts tabs, with existing generation toggles on Setup.
- Put concise provider/key/model guidance above fields; move key storage and routing details into a keyboard-accessible help tooltip.
- Remove the separate model filter input; model choices remain in the dropdown.
- Give the API key a persistent border and place Refresh model list as a left-aligned link directly beneath the dropdown.
- Add a bottom-left outline Reset Settings button with confirmation. Reset immediately clears the saved key, custom prompts, provider model selections and icon overrides, and restores default preferences. It never applies component descriptions.
- Share the default settings factory between plugin storage and UI. Cancel/Escape from confirmation preserve settings; reset also clears model browsing state.

Verification: 149 existing tests pass; production typecheck/build pass. The actual bundled UI was exercised in isolated headless Chromium with mocked Figma messages/provider catalogs: model selection and persistence, tooltip focus/Escape, Setup controls, reset confirmation, cancellation, and reset persistence. Live Figma storage/relaunch and provider generation remain on release/qa-checklist.md.

Model Reset to default sits below the model input on the right, opposite Refresh model list, and appears only when the selected model ID differs from the provider default. It restores only the current provider’s default as a draft, applied by Save and discarded by Cancel. It cancels an in-flight catalog refresh so stale responses cannot replace the reset choice.
