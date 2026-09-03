import {
  Bold,
  Button,
  Checkbox,
  Dropdown,
  DropdownOption,
  IconCheckCircle32,
  IconWarning32,
  Link,
  LoadingIndicator,
  Modal,
  Muted,
  Text,
  Textbox,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import { AIProvider, Settings } from '../types'
import { validateApiKey, ValidationStatus } from '../services/validation'

interface SettingsModalProps {
  isOpen: boolean
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
  defaultPrompt: string
  defaultVariantPrompt: string
  defaultIconPrompt: string
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
  defaultVariantPrompt,
  defaultIconPrompt
}: SettingsModalProps) {
  const [provider, setProvider] = useState<AIProvider>(settings.provider)
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt)
  const [customVariantPrompt, setCustomVariantPrompt] = useState(settings.customVariantPrompt)
  const [customIconPrompt, setCustomIconPrompt] = useState(settings.customIconPrompt)
  const [includeImage, setIncludeImage] = useState(settings.includeImage)
  const [showVariants, setShowVariants] = useState(settings.showVariants)
  const [overwriteExisting, setOverwriteExisting] = useState(settings.overwriteExisting)
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [validationError, setValidationError] = useState<string | undefined>()

  useEffect(() => {
    setProvider(settings.provider)
    setApiKey(settings.apiKey)
    setCustomPrompt(settings.customPrompt)
    setCustomVariantPrompt(settings.customVariantPrompt)
    setCustomIconPrompt(settings.customIconPrompt)
    setIncludeImage(settings.includeImage)
    setShowVariants(settings.showVariants)
    setOverwriteExisting(settings.overwriteExisting)
    setValidationStatus('idle')
    setValidationError(undefined)
  }, [settings, isOpen])

  function handleSave() {
    onSave({
      provider,
      apiKey,
      customPrompt,
      customVariantPrompt,
      customIconPrompt,
      includeImage,
      showVariants,
      overwriteExisting
    })
    onClose()
  }

  function handleProviderChange(event: h.JSX.TargetedEvent<HTMLInputElement>) {
    setProvider(event.currentTarget.value as AIProvider)
    setValidationStatus('idle')
    setValidationError(undefined)
  }

  function handleApiKeyChange(newValue: string) {
    setApiKey(newValue)
    if (validationStatus !== 'idle') {
      setValidationStatus('idle')
      setValidationError(undefined)
    }
  }

  async function handleValidate() {
    setValidationStatus('validating')
    setValidationError(undefined)

    const result = await validateApiKey(provider, apiKey)

    if (result.valid) {
      setValidationStatus('valid')
    } else {
      setValidationStatus('invalid')
      setValidationError(result.error)
    }
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
      <div style={{
        padding: '16px',
        width: '480px',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto'
      }}>
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <Textbox
              placeholder="Enter your API key..."
              value={apiKey}
              onValueInput={handleApiKeyChange}
              password
            />
          </div>
          <Button
            onClick={handleValidate}
            secondary
            disabled={!apiKey.trim() || validationStatus === 'validating'}
          >
            {validationStatus === 'validating' ? 'Validating...' : 'Validate'}
          </Button>
        </div>

        <VerticalSpace space="small" />
        {validationStatus === 'validating' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LoadingIndicator />
            <Text>
              <Muted>Checking API key...</Muted>
            </Text>
          </div>
        )}
        {validationStatus === 'valid' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ color: 'var(--figma-color-text-success, #1BC47D)', display: 'flex', alignItems: 'center' }}>
              <IconCheckCircle32 />
            </div>
            <Text style={{ color: 'var(--figma-color-text-success, #1BC47D)' }}>
              Valid API key
            </Text>
          </div>
        )}
        {validationStatus === 'invalid' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ color: 'var(--figma-color-text-danger, #F24822)', display: 'flex', alignItems: 'center' }}>
              <IconWarning32 />
            </div>
            <Text style={{ color: 'var(--figma-color-text-danger, #F24822)' }}>
              {validationError || 'Invalid API key'}
            </Text>
          </div>
        )}
        {validationStatus === 'idle' && (
          <Text>
            <Muted>{getProviderHelpText()}</Muted>
          </Text>
        )}

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
        <VerticalSpace space="extraSmall" />
        <Text>
          <Muted>Generate on a row still replaces the current description.</Muted>
        </Text>

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>
            <Bold>Icon Prompt</Bold>
          </Text>
          {customIconPrompt && (
            <Link href="#" onClick={() => setCustomIconPrompt('')}>
              Reset to default
            </Link>
          )}
        </div>
        <VerticalSpace space="small" />
        <textarea
          value={customIconPrompt || defaultIconPrompt}
          onInput={(e) => setCustomIconPrompt((e.target as HTMLTextAreaElement).value)}
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
          <Muted>Variables: {'{icon_name}'}, {'{parentName}'} · Always includes component image</Muted>
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
