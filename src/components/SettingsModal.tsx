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
import { Fragment, h } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import { AIProvider, ProviderConfig, Settings } from '../types'
import { validateApiKey, ValidationStatus } from '../services/validation'

const ALL_PROVIDERS: AIProvider[] = ['chatgpt', 'claude', 'gemini']

function getDefaultProviderChain(primaryProvider: AIProvider): ProviderConfig[] {
  return ALL_PROVIDERS.map(p => ({
    provider: p,
    apiKey: '',
    enabled: p === primaryProvider
  }))
}

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
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [validationError, setValidationError] = useState<string | undefined>()
  const [enableFallback, setEnableFallback] = useState(settings.enableFallback ?? false)
  const [providerChain, setProviderChain] = useState<ProviderConfig[]>(
    settings.providerChain ?? getDefaultProviderChain(settings.provider)
  )
  const [fallbackValidationStatus, setFallbackValidationStatus] = useState<Record<AIProvider, ValidationStatus>>({
    chatgpt: 'idle',
    claude: 'idle',
    gemini: 'idle'
  })

  useEffect(() => {
    setProvider(settings.provider)
    setApiKey(settings.apiKey)
    setCustomPrompt(settings.customPrompt)
    setCustomVariantPrompt(settings.customVariantPrompt)
    setIncludeImage(settings.includeImage)
    setShowVariants(settings.showVariants)
    setOverwriteExisting(settings.overwriteExisting)
    setValidationStatus('idle')
    setValidationError(undefined)
    setEnableFallback(settings.enableFallback ?? false)
    setProviderChain(settings.providerChain ?? getDefaultProviderChain(settings.provider))
    setFallbackValidationStatus({
      chatgpt: 'idle',
      claude: 'idle',
      gemini: 'idle'
    })
  }, [settings, isOpen])

  function handleSave() {
    onSave({
      provider,
      apiKey,
      customPrompt,
      customVariantPrompt,
      includeImage,
      showVariants,
      overwriteExisting,
      enableFallback,
      providerChain
    })
    onClose()
  }

  function handleProviderChange(event: h.JSX.TargetedEvent<HTMLInputElement>) {
    setProvider(event.currentTarget.value as AIProvider)
    // Reset validation status when provider changes
    setValidationStatus('idle')
    setValidationError(undefined)
  }

  function handleApiKeyChange(newValue: string) {
    setApiKey(newValue)
    // Reset validation status when key changes
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

  function getProviderDisplayName(p: AIProvider): string {
    switch (p) {
      case 'chatgpt': return 'ChatGPT'
      case 'claude': return 'Claude'
      case 'gemini': return 'Gemini'
      default: return p
    }
  }

  function handleFallbackApiKeyChange(targetProvider: AIProvider, newValue: string) {
    setProviderChain(prev => prev.map(config =>
      config.provider === targetProvider
        ? { ...config, apiKey: newValue }
        : config
    ))
    // Reset validation status for this provider
    setFallbackValidationStatus(prev => ({ ...prev, [targetProvider]: 'idle' }))
  }

  function handleFallbackEnabledChange(targetProvider: AIProvider, enabled: boolean) {
    setProviderChain(prev => prev.map(config =>
      config.provider === targetProvider
        ? { ...config, enabled }
        : config
    ))
  }

  async function handleValidateFallback(targetProvider: AIProvider) {
    const config = providerChain.find(c => c.provider === targetProvider)
    if (!config?.apiKey.trim()) return

    setFallbackValidationStatus(prev => ({ ...prev, [targetProvider]: 'validating' }))

    const result = await validateApiKey(targetProvider, config.apiKey)

    setFallbackValidationStatus(prev => ({
      ...prev,
      [targetProvider]: result.valid ? 'valid' : 'invalid'
    }))
  }

  function moveProviderUp(targetProvider: AIProvider) {
    setProviderChain(prev => {
      const index = prev.findIndex(c => c.provider === targetProvider)
      if (index <= 0) return prev
      const newChain = [...prev]
      const temp = newChain[index - 1]
      newChain[index - 1] = newChain[index]
      newChain[index] = temp
      return newChain
    })
  }

  function moveProviderDown(targetProvider: AIProvider) {
    setProviderChain(prev => {
      const index = prev.findIndex(c => c.provider === targetProvider)
      if (index < 0 || index >= prev.length - 1) return prev
      const newChain = [...prev]
      const temp = newChain[index + 1]
      newChain[index + 1] = newChain[index]
      newChain[index] = temp
      return newChain
    })
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

        <VerticalSpace space="large" />

        <Checkbox value={enableFallback} onValueChange={setEnableFallback}>
          <Text>Enable provider fallback</Text>
        </Checkbox>
        <VerticalSpace space="small" />
        <Text>
          <Muted>Automatically try alternative providers if the primary fails</Muted>
        </Text>

        {enableFallback && (
          <Fragment>
            <VerticalSpace space="medium" />
            <Text>
              <Bold>Provider Priority</Bold>
            </Text>
            <VerticalSpace space="small" />
            <Text>
              <Muted>Configure API keys and drag to reorder. Enabled providers will be tried in order.</Muted>
            </Text>
            <VerticalSpace space="small" />

            <div style={{
              border: '1px solid var(--figma-color-border)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              {providerChain.map((config, index) => (
                <div
                  key={config.provider}
                  style={{
                    padding: '12px',
                    borderBottom: index < providerChain.length - 1 ? '1px solid var(--figma-color-border)' : 'none',
                    backgroundColor: config.enabled ? 'transparent' : 'var(--figma-color-bg-secondary)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <Button
                        onClick={() => moveProviderUp(config.provider)}
                        secondary
                        disabled={index === 0}
                        style={{ padding: '2px 4px', minWidth: '24px', fontSize: '10px' }}
                      >
                        ▲
                      </Button>
                      <Button
                        onClick={() => moveProviderDown(config.provider)}
                        secondary
                        disabled={index === providerChain.length - 1}
                        style={{ padding: '2px 4px', minWidth: '24px', fontSize: '10px' }}
                      >
                        ▼
                      </Button>
                    </div>
                    <Checkbox
                      value={config.enabled}
                      onValueChange={(enabled) => handleFallbackEnabledChange(config.provider, enabled)}
                    >
                      <Text>
                        <Bold>{getProviderDisplayName(config.provider)}</Bold>
                        {index === 0 && <Muted> (Primary)</Muted>}
                      </Text>
                    </Checkbox>
                  </div>

                  {config.enabled && (
                    <div style={{ marginLeft: '40px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <Textbox
                            placeholder={`${getProviderDisplayName(config.provider)} API key...`}
                            value={config.apiKey}
                            onValueInput={(val) => handleFallbackApiKeyChange(config.provider, val)}
                            password
                          />
                        </div>
                        <Button
                          onClick={() => handleValidateFallback(config.provider)}
                          secondary
                          disabled={!config.apiKey.trim() || fallbackValidationStatus[config.provider] === 'validating'}
                        >
                          {fallbackValidationStatus[config.provider] === 'validating' ? '...' : 'Test'}
                        </Button>
                      </div>
                      {fallbackValidationStatus[config.provider] === 'valid' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <div style={{ color: 'var(--figma-color-text-success, #1BC47D)', display: 'flex', alignItems: 'center', transform: 'scale(0.5)' }}>
                            <IconCheckCircle32 />
                          </div>
                          <Text style={{ color: 'var(--figma-color-text-success, #1BC47D)', fontSize: '11px' }}>
                            Valid
                          </Text>
                        </div>
                      )}
                      {fallbackValidationStatus[config.provider] === 'invalid' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <div style={{ color: 'var(--figma-color-text-danger, #F24822)', display: 'flex', alignItems: 'center', transform: 'scale(0.5)' }}>
                            <IconWarning32 />
                          </div>
                          <Text style={{ color: 'var(--figma-color-text-danger, #F24822)', fontSize: '11px' }}>
                            Invalid
                          </Text>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Fragment>
        )}

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
