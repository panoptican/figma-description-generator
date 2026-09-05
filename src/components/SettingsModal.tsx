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
  Tabs,
  Text,
  Textbox,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { AIProvider, ModelSelection, Settings } from '../types'
import { DEFAULT_MODELS, loadModels, selectedModel } from '../services/models'
import { HelpTip } from './HelpTip'
import { validateApiKey, ValidationStatus } from '../services/validation'

interface SettingsModalProps {
  isOpen: boolean
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
  onReset: () => void
  defaultPrompt: string
  defaultVariantPrompt: string
  defaultIconPrompt: string
}

type SettingsTab = 'Setup' | 'Prompts'

const PROVIDER_OPTIONS: DropdownOption[] = [
  { value: 'chatgpt', text: 'ChatGPT (OpenAI)' },
  { value: 'claude', text: 'Claude (Anthropic)' },
  { value: 'gemini', text: 'Gemini (Google)' },
  { value: 'openrouter', text: 'OpenRouter' }
]

const TEXTAREA_STYLE = {
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
} as const

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onSave,
  onReset,
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
  const [confirmReset, setConfirmReset] = useState(false)
  const cancelResetRef = useRef<HTMLButtonElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmReset) cancelResetRef.current?.focus()
  }, [confirmReset])

  const [activeTab, setActiveTab] = useState<SettingsTab>('Setup')
  const [models, setModels] = useState(settings.models || {})
  const [catalog, setCatalog] = useState<ModelSelection[]>([])
  const [customModel, setCustomModel] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelError, setModelError] = useState<string>()
  const catalogRequest = useRef<AbortController | null>(null)
  const providerKeys = useRef<Partial<Record<AIProvider, string>>>({ [settings.provider]: settings.apiKey })
  const validationRequest = useRef(0)
  const model = selectedModel(provider, models)

  useEffect(() => {
    catalogRequest.current?.abort()
    catalogRequest.current = null
    validationRequest.current++
    setCatalog([])
    setCustomModel(false)
    setModelError(undefined)
    setModelsLoading(false)
    return () => { catalogRequest.current?.abort(); validationRequest.current++ }
  }, [provider, apiKey, isOpen])

  async function handleLoadModels() {
    catalogRequest.current?.abort()
    const controller = new AbortController()
    catalogRequest.current = controller
    setModelsLoading(true)
    setModelError(undefined)
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const available = await loadModels(provider, apiKey, controller.signal)
      if (catalogRequest.current !== controller) return
      setCatalog(available)
      if (!available.length) setModelError('No text models were returned. You can enter a model ID instead.')
      // Refresh capabilities for the chosen ID without changing the user's choice.
      const refreshed = available.find(item => item.id === model.id)
      if (refreshed) setModels(previous => ({ ...previous, [provider]: refreshed }))
    } catch (error) {
      if (catalogRequest.current !== controller) return
      setModelError(controller.signal.aborted ? 'Loading models timed out. Try again.'
        : error instanceof Error ? error.message : 'Could not load models.')
    } finally {
      clearTimeout(timeout)
      if (catalogRequest.current === controller) setModelsLoading(false)
    }
  }

  const modelOptions: DropdownOption[] = [...Array.from(new Map([
    DEFAULT_MODELS[provider], model, ...catalog
  ].map(item => [item.id, { value: item.id, text: item.name === item.id ? item.id : `${item.name} (${item.id})` }])).values()),
    { value: '__custom__', text: 'Enter a model ID…' }
  ]


  useEffect(() => {
    setConfirmReset(false)
    catalogRequest.current?.abort()
    catalogRequest.current = null
    setCatalog([])
    setCustomModel(false)
    setModelError(undefined)
    setModelsLoading(false)
    setModels(settings.models || {})
    providerKeys.current = { [settings.provider]: settings.apiKey }
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
    setActiveTab('Setup')
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
      overwriteExisting,
      models
    })
    onClose()
  }

  function handleProviderChange(event: h.JSX.TargetedEvent<HTMLInputElement>) {
    const nextProvider = event.currentTarget.value as AIProvider
    providerKeys.current[provider] = apiKey
    setProvider(nextProvider)
    setApiKey(providerKeys.current[nextProvider] || '')
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

  function handleTabChange(value: string) {
    if (value === 'Setup' || value === 'Prompts') {
      setActiveTab(value)
    }
  }

  async function handleValidate() {
    const request = ++validationRequest.current
    setValidationStatus('validating')
    setValidationError(undefined)

    const result = await validateApiKey(provider, apiKey)

    if (request !== validationRequest.current) return
    if (result.valid) {
      setValidationStatus('valid')
    } else {
      setValidationStatus('invalid')
      setValidationError(result.error)
    }
  }

  const providerKeyLinks: Record<AIProvider, { label: string; url: string }> = {
    chatgpt: { label: 'platform.openai.com', url: 'https://platform.openai.com/api-keys' },
    claude: { label: 'console.anthropic.com', url: 'https://console.anthropic.com/settings/keys' },
    gemini: { label: 'aistudio.google.com', url: 'https://aistudio.google.com/apikey' },
    openrouter: { label: 'openrouter.ai', url: 'https://openrouter.ai/settings/keys' }
  }
  const keyLink = providerKeyLinks[provider]

  function cancelReset() {
    setConfirmReset(false)
    setTimeout(() => resetButtonRef.current?.focus(), 0)
  }

  const panelStyle = {
    padding: '16px',
    maxHeight: 'calc(100vh - 200px)',
    overflowY: 'auto'
  }

  const setupPanel = (
    <div style={panelStyle}>
      <Text>
        <Bold>AI Provider</Bold>
      </Text>
      <VerticalSpace space="small" />
      <Text><Muted>Use your own provider API account and key. Provider charges may apply.</Muted></Text>
      <VerticalSpace space="small" />
      <Dropdown variant="border" options={PROVIDER_OPTIONS} value={provider} onChange={handleProviderChange} />

      <VerticalSpace space="large" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text><Bold>API Key</Bold></Text>
        <HelpTip id="api-key-details" label="API key privacy details" text="Your key is saved in Figma’s local plugin storage. OpenRouter routes generation requests to a model host it selects; the other options connect directly to their providers. Validation and model browsing do not generate descriptions." />
      </div>
      <VerticalSpace space="small" />
      <Text><Muted>Get your API key from <Link href={keyLink.url} target="_blank">{keyLink.label}</Link>.</Muted></Text>
      <VerticalSpace space="small" />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Textbox
            variant="border"
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
      <VerticalSpace space="large" />

      <Text><Bold>Model</Bold></Text>
      <VerticalSpace space="small" />
      <Text><Muted>We recommend {DEFAULT_MODELS[provider].name} as a low-cost starting point for component descriptions.</Muted></Text>
      <VerticalSpace space="small" />
      <Dropdown
        variant="border"
        options={modelOptions}
        value={customModel ? '__custom__' : model.id}
        onValueChange={(id) => {
          setCustomModel(id === '__custom__')
          if (id !== '__custom__') {
            const selection = catalog.find(item => item.id === id) || (id === model.id ? model : DEFAULT_MODELS[provider])
            setModels(previous => ({ ...previous, [provider]: selection }))
          }
        }}
      />
      {customModel && <VerticalSpace space="small" />}
      {customModel && (
        <Textbox
          placeholder="Model ID"
          value={models[provider]?.id || ''}
          onValueInput={(id) => setModels(previous => ({ ...previous, [provider]: { id: id.trim(), name: id.trim() } }))}
        />
      )}
      <VerticalSpace space="extraSmall" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text>
          <Link href="#"
            aria-disabled={modelsLoading || (provider !== 'openrouter' && !apiKey.trim())}
            onClick={(event) => {
              event.preventDefault()
              if (!modelsLoading && (provider === 'openrouter' || apiKey.trim())) void handleLoadModels()
            }}
            style={{ opacity: modelsLoading || (provider !== 'openrouter' && !apiKey.trim()) ? 0.5 : 1 }}>
            {modelsLoading ? 'Refreshing models…' : 'Refresh model list'}
          </Link>
        </Text>
        {model.id !== DEFAULT_MODELS[provider].id && (
          <Link href="#" onClick={(event) => {
            event.preventDefault()
            catalogRequest.current?.abort()
            catalogRequest.current = null
            setModelsLoading(false)
            setModelError(undefined)
            setCustomModel(false)
            setModels(previous => {
              const next = { ...previous }
              delete next[provider]
              return next
            })
          }}>Reset to default</Link>
        )}
      </div>
      {modelError && <Text><Muted>{modelError}</Muted></Text>}
      {model.supportsImages === false && <Text><Muted>This model is text-only. Turn off image inclusion and icon mode before generating.</Muted></Text>}
      <VerticalSpace space="large" />

      <Checkbox
        value={includeImage}
        onValueChange={setIncludeImage}
      >
        <Text>Include component image in prompt</Text>
      </Checkbox>
      <VerticalSpace space="small" />
      <Text>
        <Muted>Generation sends component names, properties, variant context, and your prompt to the provider. Enable this to also send a PNG. Icon mode always attempts to include a PNG, even when this is off.</Muted>
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
        <Muted>Generation applies immediately. Row and set generation still replace existing descriptions. Manual edits autosave.</Muted>
      </Text>
    </div>
  )

  const promptsPanel = (
    <div style={panelStyle}>
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
        style={TEXTAREA_STYLE}
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
        style={TEXTAREA_STYLE}
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
        style={TEXTAREA_STYLE}
      />
      <VerticalSpace space="small" />
      <Text>
        <Muted>Variables: {'{icon_name}'}, {'{parentName}'} · Attempts to include component image</Muted>
      </Text>
    </div>
  )

  return (
    <Modal open={isOpen} onCloseButtonClick={confirmReset ? cancelReset : onClose} title={confirmReset ? 'Reset settings?' : 'Settings'}>
      <div style={{ width: '480px' }} onKeyDown={(event) => {
        if (confirmReset && event.key === 'Escape') {
          event.stopPropagation()
          cancelReset()
        }
      }}>
        {confirmReset ? <div role="alertdialog" aria-label="Reset settings?" aria-describedby="reset-settings-description" style={{ padding: '16px' }}>
          <Text id="reset-settings-description">This clears your saved API key and restores default preferences, prompts, model choices, and icon overrides. Component descriptions won’t change. Reset takes effect immediately.</Text>
          <VerticalSpace space="large" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button ref={cancelResetRef} secondary onClick={cancelReset}>Keep settings</Button>
            <Button onClick={() => {
              catalogRequest.current?.abort()
              catalogRequest.current = null
              validationRequest.current++
              providerKeys.current = {}
              onReset()
              setConfirmReset(false)
            }}>Reset settings</Button>
          </div>
        </div> : <div>
        <Tabs
          options={[
            { value: 'Setup', children: setupPanel },
            { value: 'Prompts', children: promptsPanel }
          ]}
          value={activeTab}
          onValueChange={handleTabChange}
        />
        <div
          style={{
            padding: '16px',
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--figma-color-border)'
          }}
        >
          <div style={{ marginRight: 'auto' }}>
            <Button ref={resetButtonRef} secondary onClick={() => setConfirmReset(true)}>Reset Settings</Button>
          </div>
          <Button onClick={onClose} secondary>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={customModel && !models[provider]?.id.trim()}>
            Save
          </Button>
        </div>
        </div>}
      </div>
    </Modal>
  )
}
