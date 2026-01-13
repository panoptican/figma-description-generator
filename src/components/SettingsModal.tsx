import {
  Bold,
  Button,
  Checkbox,
  Dropdown,
  DropdownOption,
  Link,
  Modal,
  Muted,
  Text,
  Textbox,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import { AIProvider, Settings } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
  defaultPrompt: string
  defaultVariantPrompt: string
}

const PROVIDER_OPTIONS: DropdownOption[] = [
  { value: 'chatgpt', text: 'ChatGPT (OpenAI)' },
  { value: 'claude', text: 'Claude (Anthropic)' },
  { value: 'gemini', text: 'Gemini (Google)' }
]

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onSave,
  defaultPrompt,
  defaultVariantPrompt
}: SettingsModalProps) {
  const [provider, setProvider] = useState<AIProvider>(settings.provider)
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt)
  const [customVariantPrompt, setCustomVariantPrompt] = useState(settings.customVariantPrompt)
  const [includeImage, setIncludeImage] = useState(settings.includeImage)
  const [showVariants, setShowVariants] = useState(settings.showVariants)
  const [overwriteExisting, setOverwriteExisting] = useState(settings.overwriteExisting)

  useEffect(() => {
    setProvider(settings.provider)
    setApiKey(settings.apiKey)
    setCustomPrompt(settings.customPrompt)
    setCustomVariantPrompt(settings.customVariantPrompt)
    setIncludeImage(settings.includeImage)
    setShowVariants(settings.showVariants)
    setOverwriteExisting(settings.overwriteExisting)
  }, [settings, isOpen])

  function handleSave() {
    onSave({
      provider,
      apiKey,
      customPrompt,
      customVariantPrompt,
      includeImage,
      showVariants,
      overwriteExisting
    })
    onClose()
  }

  function handleProviderChange(event: h.JSX.TargetedEvent<HTMLInputElement>) {
    setProvider(event.currentTarget.value as AIProvider)
  }

  function handleApiKeyChange(newValue: string) {
    setApiKey(newValue)
  }

  function getProviderHelpText(): string {
    switch (provider) {
      case 'chatgpt':
        return 'Get your API key from platform.openai.com'
      case 'claude':
        return 'Get your API key from console.anthropic.com'
      case 'gemini':
        return 'Get your API key from aistudio.google.com'
      default:
        return ''
    }
  }

  return (
    <Modal open={isOpen} onCloseButtonClick={onClose} title="Settings">
      <div style={{ padding: '16px', width: '480px' }}>
        <Text>
          <Bold>AI Provider</Bold>
        </Text>
        <VerticalSpace space="small" />
        <Dropdown
          options={PROVIDER_OPTIONS}
          value={provider}
          onChange={handleProviderChange}
        />

        <VerticalSpace space="large" />

        <Text>
          <Bold>API Key</Bold>
        </Text>
        <VerticalSpace space="small" />
        <Textbox
          placeholder="Enter your API key..."
          value={apiKey}
          onValueInput={handleApiKeyChange}
          password
        />

        <VerticalSpace space="small" />
        <Text>
          <Muted>{getProviderHelpText()}</Muted>
        </Text>

        <VerticalSpace space="large" />

        <Checkbox
          value={includeImage}
          onValueChange={setIncludeImage}
        >
          <Text>Include component image in prompt</Text>
        </Checkbox>
        <VerticalSpace space="small" />
        <Text>
          <Muted>Sends a PNG of each component to the AI for better descriptions</Muted>
        </Text>

        <VerticalSpace space="medium" />

        <Checkbox value={showVariants} onValueChange={setShowVariants}>
          <Text>Show variants in list</Text>
        </Checkbox>
        <VerticalSpace space="extraSmall" />
        <Checkbox value={overwriteExisting} onValueChange={setOverwriteExisting}>
          <Text>Overwrite existing descriptions when generating all</Text>
        </Checkbox>

        <VerticalSpace space="extraLarge" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>
            <Bold>Component Prompt</Bold>
          </Text>
          {customPrompt && (
            <Link href="#" onClick={() => setCustomPrompt('')}>
              Reset to default
            </Link>
          )}
        </div>
        <VerticalSpace space="small" />
        <textarea
          value={customPrompt || defaultPrompt}
          onInput={(e) => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '11px',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '4px',
            resize: 'vertical',
            backgroundColor: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)'
          }}
        />
        <VerticalSpace space="small" />
        <Text>
          <Muted>Variables: {'{name}'}, {'{type}'}, {'{properties}'}</Muted>
        </Text>

        <VerticalSpace space="large" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>
            <Bold>Variant Prompt</Bold>
          </Text>
          {customVariantPrompt && (
            <Link href="#" onClick={() => setCustomVariantPrompt('')}>
              Reset to default
            </Link>
          )}
        </div>
        <VerticalSpace space="small" />
        <textarea
          value={customVariantPrompt || defaultVariantPrompt}
          onInput={(e) => setCustomVariantPrompt((e.target as HTMLTextAreaElement).value)}
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '11px',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '4px',
            resize: 'vertical',
            backgroundColor: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)'
          }}
        />
        <VerticalSpace space="small" />
        <Text>
          <Muted>Variables: {'{name}'}, {'{parentName}'}, {'{properties}'}</Muted>
        </Text>

        <VerticalSpace space="large" />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} secondary>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}
