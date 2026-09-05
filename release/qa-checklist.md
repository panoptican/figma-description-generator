# Release QA checklist

Run this against the final rebuilt plugin in a disposable Figma file. Record pass, fail, or blocked for each check; unchecked items are unverified. Record the build date, Figma client/version, OS, scope, and provider. Capture screenshots of failures without keys or confidential designs.

## Automated checks

Use the pinned Node 24 runtime.

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Review `npm audit` and `npm audit --omit=dev`; record unresolved findings separately from build success.
- [ ] The generated `manifest.json` includes `documentAccess: "dynamic-page"` and restricts network access to the four API hosts (OpenAI, Anthropic, Google, and OpenRouter).

## Prepare the file

- [ ] Include multiple pages, an empty page, standalone components, and a set with several variants.
- [ ] Include blank, whitespace-only, and existing descriptions.
- [ ] Include an `Icons` page, an ordinary component page, and an `Iconography` page to check icon detection boundaries.
- [ ] Import the built plugin from the root `manifest.json` and reopen after rebuilding.

## Launch and dynamic page loading

- [ ] Without a saved key, setup guidance appears and generation is disabled.
- [ ] This page on the empty page shows the empty state.
- [ ] This page lists only the active page. Switching pages refreshes the inventory automatically.
- [ ] Reopen the Figma file, then launch Entire file before visiting other pages. Components on previously unloaded pages appear.
- [ ] Click a component name on a different page. Navigation, selection, and viewport focus succeed.
- [ ] Generate and manually edit a component on a previously unloaded page. Inspect its actual Figma description field to confirm writes succeed.
- [ ] Delete a listed component in Figma, then try its row action before rescanning. A missing node produces a recoverable result without leaving the plugin stuck.

## Settings and header regressions

- [ ] Expand several rows, then repeatedly open and close Settings with Save, Cancel, close button, and Escape. The dialog appears consistently and rows do not unexpectedly collapse.
- [ ] Saved provider, key, prompts, and preferences survive reopening. Cancel and Escape discard unsaved modal changes.
- [ ] Setup explains API account/key requirements, possible provider charges, immediate application, and the icon image exception.
- [ ] Rescan icon renders correctly in light and dark themes. Add, rename, and delete a component; rescan updates the inventory without duplicates.
- [ ] Header layout remains usable after export removal. No CSV/JSON export action or modal is present.

## Provider requests and images

Repeat for OpenAI, Anthropic, Google, and OpenRouter; mark unavailable accounts/models as blocked rather than passed. Calls may incur provider charges.

- [ ] Save and validate a valid key, then generate a real description in This page and Entire file. Validation alone is not proof of generation access.
- [ ] With images off and icon mode off, text-only generation succeeds.
- [ ] With images on, generation succeeds for a component with distinctive visual content. Inspect the request in the developer tools if needed to confirm an image was attached; do not share keys or payloads.
- [ ] With images off and icon mode on, an image is still attempted and the icon naming prompt is used.
- [ ] Invalid keys and disconnected network produce readable errors, clear loading states, preserve existing descriptions, and allow retry.
- [ ] Where practical, exercise quota and model-access errors and confirm recovery.

- [ ] OpenRouter Validate checks the key without generation; test exhausted credits and confirm that an incomplete GLM response does not replace a description. The GLM default uses low reasoning effort; OpenRouter has a 4,096-token response budget. Other choices use their catalog capabilities or API defaults.

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
- [x] Publisher approved `../PRIVACY.md`, effective September 4, 2026.
- [ ] Publish the approved policy and verify its public URL while signed out.
- [ ] Verify the public support URL while signed out. Do not include secrets or private designs in public issues.
- [ ] Confirm publisher identity, account prerequisites, Figma-assigned plugin ID preserved in build configuration, and current submission form requirements.
- [ ] Complete the form and verify In review separately from local QA. Published is a separate approval state.

## Model selection

- [ ] Existing settings keep the four default models. OpenRouter is labeled as a provider.
- [ ] Refresh model list for each provider; select a non-default, Save, reopen, and verify the selection survives. Repeat across providers to check choices remain separate.
- [ ] Confirm a new/custom model ID appears in the outgoing request. Model browsing and Validate do not generate descriptions or transmit component content.
- [ ] Browse a long catalog, choose a model, and verify dropdown and Save/Cancel remain usable.
- [ ] Change provider or key while loading; stale responses must not replace the new provider's list. A failed catalog request leaves saved/default choices available.
- [ ] Switch providers and check the previous provider's key is not reused for a different API service.
- [ ] Choose an OpenRouter text-only model with images or icon mode enabled; generation should explain the incompatibility without sending the image.
- [ ] Check custom models and reasoning-capable models on each endpoint; API-specific compatibility and access are not guaranteed by catalog presence.

- [ ] API key field has a visible border before hover. Privacy tooltip opens on hover/focus and Escape dismisses it without closing Settings.
- [ ] Reset Settings opens confirmation; Keep settings and Escape preserve settings. Confirming restores defaults and clears the saved key and icon overrides without changing component descriptions. Reopen the plugin to verify persistence.

- [ ] Model Reset to default restores the current provider’s default only; Save persists it and Cancel discards it. Refresh model list is a left-aligned link directly beneath the dropdown.

- [ ] Turn Show variants in list off: Fill/Replace counts exclude variants, generation changes only sets and standalone components, and Generate all descriptions is hidden. Turn it on: variants return to counts and generation.
