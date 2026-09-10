# Settings refinement

Completed September 4, 2026.

- Use three peer tabs: AI connection, Preferences, and Prompts. Open on AI connection; avoid repeating each tab name as a section heading. Generation toggles live directly on Preferences.
- Put concise provider/key/model guidance above fields; move key storage and routing details into a keyboard-accessible help tooltip.
- Remove the separate model filter input; model choices remain in the dropdown.
- Give the API key a persistent border. Place Refresh model list at the very bottom of the model dropdown, separated from model choices and Enter a model ID. The action preserves the selected model and custom-entry state. Show loading feedback below the field; disable refresh while loading or when the provider requires a missing key.
- Add a bottom-left outline Reset Settings button with confirmation. Reset immediately clears the saved key, custom prompts, provider model selections and icon overrides, and restores default preferences. It never applies component descriptions.
- Share the default settings factory between plugin storage and UI. Cancel/Escape from confirmation preserve settings; reset also clears model browsing state.

Verification: 149 existing tests pass; production typecheck/build pass. The actual bundled UI was exercised in isolated headless Chromium with mocked Figma messages/provider catalogs: model selection and persistence, tooltip focus/Escape, Setup controls, reset confirmation, cancellation, and reset persistence. Live Figma storage/relaunch and provider generation remain on release/qa-checklist.md.

Model Reset to default sits below the model input on the right and appears only when the selected model ID differs from the provider default. It restores only the current provider’s default as a draft, applied by Save and discarded by Cancel. It cancels an in-flight catalog refresh so stale responses cannot replace the reset choice. Catalog responses refresh capabilities for the model currently selected, preserving any choice made while loading.

Latest tab and dropdown update: 170 tests pass; production typecheck/build pass. Inspected the installed dropdown's controlled selection, separator, and disabled-option behavior. Live Figma checks of the new tabs and refresh menu action remain pending; the earlier browser verification above predates this update.
