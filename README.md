# Description Generator

Edit Figma component descriptions in one place, or use AI to write a first pass. Works with standalone components, component sets, and variants across a page or an entire file. No account or API key is needed.

The service includes 1,000 free descriptions per Figma user for life. Pro is $10/month or $96/year and includes 10,000 descriptions per UTC calendar month; the default seven-day trial counts as Pro.

## What it does

- Search components by name, page, or properties and edit descriptions inline.
- Generate one description, a component set and its variants, or a batch of missing descriptions.
- Use your own prompts, include component images, or turn on icon mode to generate alternative names for easier discovery.

Generated descriptions apply immediately. Manual edits autosave. **Revert** restores the previous description during the current session.

With a row control or editor focused, **Cmd/Ctrl+G** generates that row only, including individual variants. **Escape** collapses the focused row. **Cmd/Ctrl+Z** reverts the focused row outside text editors; inside an editor it keeps normal text undo.

**Fill** skips existing descriptions; **Replace** overwrites them. Individual generation actions always replace their targets. Turning off **Show variants in list** also excludes variants from generation.

## Run locally

Use Node 24 (pinned to `24.12.0`) and Figma Desktop.

```bash
git clone https://github.com/panoptican/figma-description-generator.git
cd figma-description-generator
npm ci
npm run build
```

In Figma, choose **Plugins → Development → Import plugin from manifest** and select this repo's `manifest.json`. Run **Description Generator → This page** or **Entire file**.

Generation goes through the project's own service, a Cloudflare Worker in [worker/](worker/README.md) that holds the Gemini key. A local build points at the published service; to run your own, follow the setup guide there and update the endpoint.

## Development

Built with TypeScript, Preact, and create-figma-plugin. `src/main.ts` handles Figma reads and writes; `src/components/` contains the UI; `src/services/ai.ts` builds prompts and calls the generation service; `worker/` is the service itself.

```bash
npm run watch  # Rebuild as you edit; reopen the plugin in Figma
npm test       # Run unit tests for the plugin and the Worker
npm run build # Typecheck and create production bundles
```

Before a release, run the [QA checklist](release/qa-checklist.md) in Figma. Listing copy and artwork live in [release/](release/README.md).

## Privacy and support

Preferences are saved in Figma's local plugin storage. Generation sends prompts and component context to the Description Generator service, which forwards them to Google's Gemini API and returns the text. The service keeps no copy of prompts or descriptions.

Images are optional for ordinary components. Icon mode always attempts to include an image, even when the general image setting is off.

[Privacy policy](PRIVACY.md) · [Report an issue](https://github.com/panoptican/figma-description-generator/issues)
