# Description Generator privacy policy

Effective September 9, 2026. Pending publisher approval.

## What the plugin reads and changes

Description Generator reads components, component sets, variants, names, properties, page names, and existing descriptions within the launch scope you choose: This page or Entire file. It uses this information to display and organize the list and prepare generation requests. Scanning does not itself send component data anywhere.

Generated descriptions are applied immediately to the corresponding Figma nodes. Manual edits also write to those nodes after a short autosave delay or when the edited row closes. Descriptions become part of the Figma file and are subject to its access and sharing settings.

## Data sent when you generate

When you generate a description, the plugin sends a request to the Description Generator service, operated by the plugin publisher on Cloudflare Workers. The service forwards the request to Google's Gemini API using the publisher's own key and returns the generated text. You do not need an account or API key, and the plugin never sends one.

The generated prompt can contain component names, types, properties, parent component names, names and properties of sibling variants in a set, and text from your custom prompts. A component image is included when image inclusion is enabled. Icon mode always attempts to include a PNG image, even when the general image setting is off. If the image cannot be produced, generation continues without it. Images can contain visible text and other design content.

The plugin does not automatically include existing description text, page names, or the entire file in generation requests. Custom prompt text is sent as entered after supported variables are substituted. Avoid putting information in prompts or components that you do not intend to share.

The plugin connects only to the service host listed in its manifest. The service connects only to `generativelanguage.googleapis.com`.

## What the service keeps

The service does not store prompts, images, or generated descriptions. To enforce the free and Pro limits, it stores your Figma user ID, plan, lifetime and monthly counts, and first-seen and update timestamps in Cloudflare D1. The service receives identity and payment status from Figma's payments API; Figma handles payment details and the plugin never sees card data. A short-lived cache stores only a SHA-256 hash of the Figma payment token.

The service records token counts of each successful request for cost monitoring, and Cloudflare records standard request metadata such as the requesting network address, which the service also uses to limit how many requests one address can make per minute. These logs are held by Cloudflare for a short period.

Google processes each request under the Gemini API terms for paid use, which state that prompts are not used to improve Google's models. The publisher does not control Google's or Cloudflare's retention periods or processing locations; consult their policies for current details.

## Local storage

The plugin saves custom prompts, display and generation preferences, and component-specific icon overrides in Figma's local `clientStorage`. These settings persist between plugin sessions. Component descriptions are stored in the Figma file, separately from these settings. Previous-description values used by Revert are held in the running plugin session.

Earlier versions of this plugin stored a user-supplied provider API key. The current version removes any saved key from local storage the first time it runs.

The plugin does not include analytics or advertising. It can write diagnostic errors to the local developer console; review logs and screenshots before sharing them in a support request.

## Your controls

- To stop future requests, stop generation and close the plugin. Stop remaining cannot withdraw requests already sent or undo descriptions already applied.
- To replace stored custom prompt text, clear it or reset it to the default and Save.
- To generate without images, turn off Include component image and ensure icon mode is off for every targeted component.
- Edit or remove descriptions in Figma. This does not alter Figma's file history.

Use **Reset Settings** in Settings to restore default preferences, prompts, and icon overrides. A confirmation is required; component descriptions are unchanged.

## Third-party handling

Figma controls its own application, storage, and file services. Cloudflare hosts the service, and Google operates the Gemini API. Each handles requests under its applicable terms. This plugin does not set or guarantee those services' retention periods, training practices, processing locations, or deletion policies.

## Questions and support

Use the [project issue tracker](https://github.com/panoptican/figma-description-generator/issues) for questions about the plugin's behavior. Issues are public: do not post confidential designs or personal information.
