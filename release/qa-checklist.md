# Release QA checklist

Run the automated checks first:

- `npm test`
- `npm run build`
- `npm audit`
- `npm audit --omit=dev`

In Figma development mode:

- Load the built plugin from `manifest.json`.
- Exercise This page and Entire file.
- Generate a single component and a component set with variants.
- Run Generate All with at least three components and confirm progress completes.
- Enable image inclusion and verify image-aware generation for each provider.
- Toggle icon mode, close and reopen the plugin, and confirm the override persists.
- Edit and apply a description, then use revert and the Cmd/Ctrl+G shortcut.
- Verify invalid keys, provider errors, and missing network access produce readable errors.
- Confirm the generated manifest contains all three provider domains.
