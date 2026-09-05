# Figma Community listing draft

## Name

Description Generator

## Tagline

Generate and edit descriptions for Figma components and variants.

## Description

Write descriptions for your Figma components, sets, and variants with OpenAI, Anthropic, Google, or OpenRouter. Run it on the current page or the whole file. Pick a model from the provider's current catalog, or enter a model ID. Your choice is remembered for each provider. Use the built-in prompts, or write your own.

Generate one component, a set, or a batch. Descriptions are written directly to Figma, and edits autosave. Use Revert to restore the previous text during the session. Fill skips descriptions you already have; Replace overwrites them. Generating from an individual component or set always replaces its description.

Include a component image for visual context. Icon mode generates alternative names to help people find an icon and always tries to include its image, even with the general image setting off. For text-only requests, turn off both image inclusion and icon mode.

You'll need your own provider API account and key, with access to the model the plugin uses. Provider charges vary by model. Validating a key and loading the model list do not generate text. Your key and settings are saved in Figma's local plugin storage. OpenRouter uses its own API key; its requests pass through OpenRouter to a model host it selects. The other options connect directly to their providers. Requests can include component names, properties, parent and variant context, prompts, and images. There's no Description Generator server or separate account. Check your provider's terms before sending confidential designs.

## Suggested category

Design tools

## Support

https://github.com/panoptican/figma-description-generator/issues

Repository: https://github.com/panoptican/figma-description-generator

## Privacy policy

Approved September 4, 2026: [Privacy policy](https://github.com/panoptican/figma-description-generator/blob/main/PRIVACY.md). Verify the public link after pushing before adding it to the Community form.

## Submission notes

- Upload `release/assets/icon.png` as the plugin icon.
- Upload `release/assets/thumbnail.png` as the listing thumbnail; review the artwork for consistency with the current interface.
- Publish the approved privacy policy and verify its URL and the support URL while signed out.
- Complete the current Community form's service and privacy disclosures using the behavior above.
- Run [`qa-checklist.md`](qa-checklist.md) against the final built plugin, recording blocked provider tests separately from passes.
