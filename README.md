# Description Generator

Edit Figma component descriptions in one place, or use AI to write a first pass. Works with standalone components, component sets, and variants across a page or an entire file. Manual editing doesn't need an API key.

## What it does

- Search components by name, page, or properties and edit descriptions inline.
- Generate one description, a component set and its variants, or a batch of missing descriptions.
- Choose OpenAI, Anthropic, Google, or OpenRouter. Refresh the model list or enter a model ID; the plugin remembers your choice for each provider.
- Use your own prompts, include component images, or turn on icon mode to generate alternative names for easier discovery.

Generated descriptions apply immediately. Manual edits autosave. **Revert** restores the previous description during the current session.

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

To generate with AI, open **Settings**, choose a provider, and add your API key. You'll need a provider API account with model access; charges may apply. Validate checks the key without generating a description.

## Development

Built with TypeScript, Preact, and create-figma-plugin. `src/main.ts` handles Figma reads and writes; `src/components/` contains the UI; `src/services/` handles model catalogs and AI requests.

```bash
npm run watch  # Rebuild as you edit; reopen the plugin in Figma
npm test       # Run unit tests
npm run build # Typecheck and create production bundles
```

Before a release, run the [QA checklist](release/qa-checklist.md) in Figma. Listing copy and artwork live in [release/](release/README.md).

## Privacy and support

Keys and preferences are saved in Figma's local plugin storage. Generation sends prompts and component context to your selected provider. OpenRouter routes requests through its API to a model host. There's no Description Generator backend.

Images are optional for ordinary components. Icon mode always attempts to include an image, even when the general image setting is off.

[Privacy policy](PRIVACY.md) · [Report an issue](https://github.com/panoptican/figma-description-generator/issues)
