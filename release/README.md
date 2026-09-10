# Community release collateral

This directory contains the draft Figma Community listing copy, release QA checklist, and artwork prepared for submission. The approved privacy policy is at [`../PRIVACY.md`](../PRIVACY.md).

The icon is 128×128 PNG and the thumbnail is 1920×1080 PNG. Review artwork against the current interface. Before submission, publish the approved privacy policy, add its public URL to the Community form, and verify that both it and the support URL in `community-listing.md` work while signed out. Local drafts do not establish public availability or submission.

## Interactive QA checklist

Run `npm run qa` from the project directory, then open **http://127.0.0.1:4318/**. Use the same browser and URL each time to keep your saved results. The server listens only on this computer and serves only the checklist files; it receives no uploads. Stop it with Ctrl+C in its terminal.

The tool reads `qa-checklist.md` directly. Record Not tested, Pass, Fail, or Blocked, add notes, and attach screenshots with the file chooser, drag and drop, or by pasting while the screenshot area is focused. Reviewed and passed counts are distinct; failures and blocked checks never count as passes. Only items already checked in Markdown start as passed.

Results, environment details, and original screenshots are stored in IndexedDB in this browser. **Export backup** downloads a JSON file including every result and image. **Import backup** previews the count and asks before replacing matching results; unrelated results remain. Export before clearing browser data, switching browsers, or changing the server URL. Screenshots accept PNG, JPG, WebP, or GIF, up to 15 MB each and 10 per result; backup import accepts up to 200 MB. Backups may contain private notes and designs, so review them before sharing.

Item IDs are derived from the section name and full check text. Reordering items preserves their results. Changing a check starts a new untested result; older results remain available in backups. The interactive tool never marks the source Markdown automatically, and it does not infer passes from an overall percentage of QA completed.

Verification: run `node --check scripts/qa-checklist.mjs` and `node --check release/checklist/app.js`. In a disposable browser profile, verify status and notes after reload, per-provider independence, screenshot attachment/preview/removal, filters, and backup restore (including images and cancellation). Check narrow and dark-mode layouts. This tool is independent of the Figma plugin build and adds no dependencies.

Verified September 4, 2026: both syntax checks passed. An isolated Chromium profile exercised all 60 source items / 96 provider-specific results, status and environment persistence, image upload/preview/reload/removal, drag-and-drop and paste handlers, provider isolation, filters, backup export/restore, import cancellation and malformed-backup rejection, invalid-image rejection, and the server's file allowlist. Desktop, dark, and 390px-wide screenshots were inspected. Temporary harness and output: `/private/tmp/description-generator-checklist-qa/`. These fixture results were kept separate from the user's checklist; no live Figma checks were marked passed.
