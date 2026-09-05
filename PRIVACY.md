# Description Generator privacy policy

Effective September 4, 2026.

## What the plugin reads and changes

Description Generator reads components, component sets, variants, names, properties, page names, and existing descriptions within the launch scope you choose: This page or Entire file. It uses this information to display and organize the list and prepare generation requests. Scanning does not itself send component data to an AI provider.

Generated descriptions are applied immediately to the corresponding Figma nodes. Manual edits also write to those nodes after a short autosave delay or when the edited row closes. Descriptions become part of the Figma file and are subject to its access and sharing settings.

## Data sent to AI providers

When you generate a description, the plugin sends a request directly from its interface to the provider you select: OpenAI, Anthropic, Google, or OpenRouter. Your API key authenticates that request. OpenRouter routes generation requests to a model host according to its routing and your account settings; both OpenRouter and that host process the request content.

The generated prompt can contain component names, types, properties, parent component names, names and properties of sibling variants in a set, and text from your custom prompts. A component image is included when image inclusion is enabled. Icon mode always attempts to include a PNG image, even when the general image setting is off. If the image cannot be produced, generation continues without it. Images can contain visible text and other design content.

The plugin does not automatically include existing description text, page names, or the entire file in generation requests. Custom prompt text is sent as entered after supported variables are substituted. Avoid putting information in prompts or components that you do not intend to share with your provider.

The plugin connects to these API hosts:

- OpenAI: `api.openai.com`
- Anthropic: `api.anthropic.com`
- Google: `generativelanguage.googleapis.com`
- OpenRouter: `openrouter.ai` (which forwards generation requests to a model host)

When you click Validate, the plugin sends your key to the selected provider. OpenAI, Anthropic, and Google receive a request for their model list. OpenRouter receives an authenticated request for information about the current API key. Validation does not generate text or include component content.

When you click Refresh model list, the plugin requests the current catalog. OpenAI, Anthropic, and Google authenticate catalog requests using your key. OpenRouter's catalog is public and is requested without a key. Browsing models does not send component content or generate descriptions. Provider charges may apply when you generate descriptions; rates depend on the selected model and host.

## Local storage and project-operated services

The plugin saves the selected provider, API key, custom prompts, per-provider model selections and catalog capability details, display and generation preferences, and component-specific icon overrides in Figma's local `clientStorage`. These settings persist between plugin sessions. Component descriptions are stored in the Figma file, separately from these settings. Previous-description values used by Revert are held in the running plugin session.

The plugin does not operate a backend, analytics service, or advertising service. It does not send keys or design content to a Description Generator server. It can write diagnostic errors to the local developer console; review logs and screenshots before sharing them in a support request.

## Your controls

- To stop future requests, stop generation and close the plugin. Stop remaining cannot withdraw requests already sent or undo descriptions already applied.
- To remove the saved API key value, clear the API key field in Settings and Save. Revoke a key through its provider to invalidate it.
- To replace stored custom prompt text, clear it or reset it to the default and Save.
- To generate without images, turn off Include component image and ensure icon mode is off for every targeted component.
- Edit or remove descriptions in Figma. This does not remove content already received by an AI provider or alter Figma's file history.

Use **Reset Settings** in Settings to clear the saved API key and restore default preferences, prompts, model choices, and icon overrides. A confirmation is required; component descriptions are unchanged. It does not provide deletion controls for provider-side records.

## Third-party handling

Figma controls its own application, storage, and file services. Your chosen AI service, including OpenRouter and its selected model host, handles requests under its applicable terms and account settings. This plugin does not set or guarantee those services' retention periods, training practices, processing locations, or deletion policies. Consult the service directly for its current policies and account controls.

## Questions and support

Use the [project issue tracker](https://github.com/panoptican/figma-description-generator/issues) for questions about the plugin's behavior. Issues are public: do not post API keys, confidential designs, or personal information. For provider account or data requests, contact the relevant provider directly.
