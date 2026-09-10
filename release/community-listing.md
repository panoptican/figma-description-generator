# Figma Community listing draft

## Name

Description Generator

## Tagline

Generate and edit descriptions for Figma components and variants.

## Description

Write descriptions for your Figma components, sets, and variants. Run it on the current page or the whole file. Use the built-in prompts, or write your own. No account, API key, or setup: generation is included.

The free tier includes 1,000 descriptions per Figma user for the lifetime of the account. Pro is $10/month or $96/year and includes 10,000 descriptions per UTC calendar month. Figma's default seven-day subscription trial counts as Pro.

Generate one component, a set, or a batch. Descriptions are written directly to Figma, and edits autosave. Use Revert to restore the previous text during the session. Fill skips descriptions you already have; Replace overwrites them. Generating from an individual component or set always replaces its description.

Include a component image for visual context. Icon mode generates alternative names to help people find an icon and always tries to include its image, even with the general image setting off. For text-only requests, turn off both image inclusion and icon mode.

Requests go to the plugin's own service, which forwards them to Google's Gemini API and returns the text. Requests can include component names, properties, parent and variant context, prompts, and images. The service keeps no copy of prompts or descriptions. Your preferences stay in Figma's local plugin storage. Check the privacy policy before sending confidential designs.

## Suggested category

Design tools

## Support

https://github.com/panoptican/figma-description-generator/issues

Repository: https://github.com/panoptican/figma-description-generator

## Privacy policy

Revised September 9, 2026 for the publisher-managed service; pending publisher approval: [Privacy policy](https://github.com/panoptican/figma-description-generator/blob/main/PRIVACY.md). Verify the public link after pushing before adding it to the Community form.

## Submission notes

- Figma review feedback (September 2026): remove the BYOK requirement and switch to a publisher-managed AI flow, then resubmit. Confirmed by Figma that the plugin is approvable after that change.
- Upload `release/assets/icon.png` as the plugin icon.
- Upload `release/assets/thumbnail.png` as the listing thumbnail; review the artwork for consistency with the current interface, which no longer has an AI connection tab.
- Publish the approved privacy policy and verify its URL and the support URL while signed out.
- Complete the current Community form's service and privacy disclosures: the plugin contacts one publisher-operated host, which contacts Google's Gemini API.
- Run [`qa-checklist.md`](qa-checklist.md) against the final built plugin with the deployed service.
