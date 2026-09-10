import {
  Button,
  Checkbox,
  Link,
  Modal,
  Muted,
  Tabs,
  Text,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import styles from './SettingsModal.module.css'
import { Settings } from '../types'

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

type SettingsTab = 'Preferences' | 'Prompts'

const TEXTAREA_STYLE = {
  width: '100%',
  minHeight: '96px',
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
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt)
  const [customVariantPrompt, setCustomVariantPrompt] = useState(settings.customVariantPrompt)
  const [customIconPrompt, setCustomIconPrompt] = useState(settings.customIconPrompt)
  const [includeImage, setIncludeImage] = useState(settings.includeImage)
  const [showVariants, setShowVariants] = useState(settings.showVariants)
  const [overwriteExisting, setOverwriteExisting] = useState(settings.overwriteExisting)
  const [confirmReset, setConfirmReset] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>('Preferences')
  const cancelResetRef = useRef<HTMLButtonElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmReset) cancelResetRef.current?.focus()
  }, [confirmReset])

  useEffect(() => {
    setConfirmReset(false)
    setCustomPrompt(settings.customPrompt)
    setCustomVariantPrompt(settings.customVariantPrompt)
    setCustomIconPrompt(settings.customIconPrompt)
    setIncludeImage(settings.includeImage)
    setShowVariants(settings.showVariants)
    setOverwriteExisting(settings.overwriteExisting)
    setActiveTab('Preferences')
  }, [settings, isOpen])

  function handleSave() {
    onSave({
      customPrompt,
      customVariantPrompt,
      customIconPrompt,
      includeImage,
      showVariants,
      overwriteExisting
    })
    onClose()
  }

  function handleTabChange(value: string) {
    if (value === 'Preferences' || value === 'Prompts') {
      setActiveTab(value)
    }
  }

  function cancelReset() {
    setConfirmReset(false)
    setTimeout(() => resetButtonRef.current?.focus(), 0)
  }

  const preferencesPanel = (
    <div className={styles.panel}>
      <section className={styles.section} aria-label="Preferences">
        <div className={styles.options}>
          <div>
            <Checkbox value={includeImage} onValueChange={setIncludeImage}>
              <Text>Include component image in prompt</Text>
            </Checkbox>
            <div className={styles.optionHelp}>
              <Text><Muted>Generation sends component names, properties, variant context, and your prompt to the Description Generator service, which forwards them to Google Gemini. Enable this to also send a PNG. Icon mode always attempts to include a PNG, even when this is off. The service counts descriptions per Figma user for the free and Pro limits.</Muted></Text>
            </div>
          </div>
          <div>
            <Checkbox value={showVariants} onValueChange={setShowVariants}>
              <Text>Show variants in list</Text>
            </Checkbox>
            <div className={styles.optionHelp}>
              <Text><Muted>Hidden variants are excluded from generation.</Muted></Text>
            </div>
          </div>
          <div>
            <Checkbox value={overwriteExisting} onValueChange={setOverwriteExisting}>
              <Text>Overwrite existing descriptions when generating all</Text>
            </Checkbox>
            <div className={styles.optionHelp}>
              <Text><Muted>Generation applies immediately. Row and set generation still replace existing descriptions. Manual edits autosave.</Muted></Text>
            </div>
          </div>
        </div>
      </section>
    </div>
  )

  const promptsPanel = (
    <div className={styles.panel}>
      <section className={styles.section} aria-labelledby="component-prompt-title">
        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <h2 className={styles.sectionTitle} id="component-prompt-title">Component prompt</h2>
            {customPrompt && (
              <Link href="#" onClick={() => setCustomPrompt('')}>
                Reset to default
              </Link>
            )}
          </div>
          <textarea
            aria-labelledby="component-prompt-title"
            value={customPrompt || defaultPrompt}
            onInput={(e) => setCustomPrompt((e.target as HTMLTextAreaElement).value)}
            style={TEXTAREA_STYLE}
          />
          <Text>
            <Muted>Variables: {'{name}'}, {'{type}'}, {'{properties}'}</Muted>
          </Text>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="variant-prompt-title">
        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <h2 className={styles.sectionTitle} id="variant-prompt-title">Variant prompt</h2>
            {customVariantPrompt && (
              <Link href="#" onClick={() => setCustomVariantPrompt('')}>
                Reset to default
              </Link>
            )}
          </div>
          <textarea
            aria-labelledby="variant-prompt-title"
            value={customVariantPrompt || defaultVariantPrompt}
            onInput={(e) => setCustomVariantPrompt((e.target as HTMLTextAreaElement).value)}
            style={TEXTAREA_STYLE}
          />
          <Text>
            <Muted>Variables: {'{name}'}, {'{parentName}'}, {'{properties}'}</Muted>
          </Text>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="icon-prompt-title">
        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <h2 className={styles.sectionTitle} id="icon-prompt-title">Icon prompt</h2>
            {customIconPrompt && (
              <Link href="#" onClick={() => setCustomIconPrompt('')}>
                Reset to default
              </Link>
            )}
          </div>
          <textarea
            aria-labelledby="icon-prompt-title"
            value={customIconPrompt || defaultIconPrompt}
            onInput={(e) => setCustomIconPrompt((e.target as HTMLTextAreaElement).value)}
            style={TEXTAREA_STYLE}
          />
          <Text>
            <Muted>Variables: {'{icon_name}'}, {'{parentName}'} · Attempts to include component image</Muted>
          </Text>
        </div>
      </section>
    </div>
  )

  return (
    <Modal open={isOpen} onCloseButtonClick={confirmReset ? cancelReset : onClose} title={confirmReset ? 'Reset settings?' : 'Settings'}>
      <div className={styles.modal} onKeyDown={(event) => {
        if (confirmReset && event.key === 'Escape') {
          event.stopPropagation()
          cancelReset()
        }
      }}>
        {confirmReset ? <div role="alertdialog" aria-label="Reset settings?" aria-describedby="reset-settings-description" style={{ padding: '16px' }}>
          <Text id="reset-settings-description">This restores default preferences, prompts, and icon overrides. Component descriptions won’t change. Reset takes effect immediately.</Text>
          <VerticalSpace space="large" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button ref={cancelResetRef} secondary onClick={cancelReset}>Keep settings</Button>
            <Button onClick={() => {
              onReset()
              setConfirmReset(false)
            }}>Reset settings</Button>
          </div>
        </div> : <div>
        <Tabs
          options={[
            { value: 'Preferences', children: preferencesPanel },
            { value: 'Prompts', children: promptsPanel }
          ]}
          value={activeTab}
          onValueChange={handleTabChange}
        />
        <div className={styles.footer}>
          <div style={{ marginRight: 'auto' }}>
            <Button ref={resetButtonRef} secondary onClick={() => setConfirmReset(true)}>Reset Settings</Button>
          </div>
          <Button onClick={onClose} secondary>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
        </div>}
      </div>
    </Modal>
  )
}
