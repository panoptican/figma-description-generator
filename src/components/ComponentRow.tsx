import { Button } from '@create-figma-plugin/ui'
import { ComponentChildren, h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { ComponentData } from '../types'
import { GenerationError } from '../services/generationRunner'
import { getDescriptionStatus } from '../utils/descriptionStatus'
import { handleRowKeyboardShortcut } from '../hooks/useKeyboardShortcuts'
import styles from '../ui.css'

interface ComponentRowProps {
  component: ComponentData
  showVariants: boolean
  isModalOpen?: boolean
  isHidden?: boolean
  isSticky?: boolean
  variantsControl?: ComponentChildren
  onGenerate: (component: ComponentData) => Promise<void>
  onGenerateComponentSet: (component: ComponentData) => Promise<void>
  onConfirm: (id: string, description: string) => void
  onRevert: (id: string) => void
  onSelect: (id: string) => void
  isGenerating: boolean
  externalError?: GenerationError
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  isIcon: boolean
  onDisableIcon: (id: string) => void
  wasGeneratedThisSession: boolean
  onUpgrade: () => void
  isPending: boolean
}

function truncateDescription(text: string | undefined, maxLength: number = 60): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

export function ComponentRow({
  component,
  isModalOpen = false,
  isHidden = false,
  isSticky = false,
  variantsControl,
  showVariants,
  onGenerate,
  onGenerateComponentSet,
  onConfirm,
  onRevert,
  onSelect,
  isGenerating,
  externalError,
  isExpanded,
  onToggleExpand,
  isIcon,
  onDisableIcon,
  wasGeneratedThisSession,
  onUpgrade,
  isPending
}: ComponentRowProps) {
  const [description, setDescription] = useState(component.currentDescription)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const descriptionRef = useRef(description)
  const isDirtyRef = useRef(isDirty)
  const currentDescriptionRef = useRef(component.currentDescription)
  const onConfirmRef = useRef(onConfirm)
  const componentIdRef = useRef(component.id)
  const rowElementRef = useRef<HTMLDivElement | null>(null)
  const toggleFocusFrameRef = useRef<number | null>(null)

  descriptionRef.current = description
  isDirtyRef.current = isDirty
  currentDescriptionRef.current = component.currentDescription
  onConfirmRef.current = onConfirm
  componentIdRef.current = component.id

  useEffect(() => {
    setDescription(component.currentDescription)
    setIsDirty(false)
    setIsSaving(false)
  }, [component.currentDescription])

  useEffect(() => {
    if (!isDirty || description === component.currentDescription) {
      return
    }

    if (!isExpanded) {
      onConfirm(component.id, description)
      isDirtyRef.current = false
      setIsDirty(false)
      return
    }

    const timeout = setTimeout(() => {
      setIsSaving(true)
      onConfirm(component.id, description)
      setIsDirty(false)
    }, 800)

    return () => clearTimeout(timeout)
  }, [description, isDirty, isExpanded, component.currentDescription, component.id, onConfirm])

  useEffect(() => {
    return () => {
      if (!isDirtyRef.current || descriptionRef.current === currentDescriptionRef.current) {
        return
      }

      onConfirmRef.current(componentIdRef.current, descriptionRef.current)
    }
  }, [])

  useEffect(() => () => {
    if (toggleFocusFrameRef.current !== null) cancelAnimationFrame(toggleFocusFrameRef.current)
  }, [])

  const descriptionStatus = getDescriptionStatus(component.currentDescription, wasGeneratedThisSession)
  const isEmpty = descriptionStatus === 'missing'
  const descriptionStatusLabel = descriptionStatus === 'generated'
    ? 'Generated this session'
    : 'Has description'
  const feedbackLabel = externalError
    ? null
    : isPending
      ? 'Generating...'
      : isSaving
        ? 'Saving...'
        : isDirty
          ? 'Unsaved changes'
          : null
  const relationshipLabel = component.type === 'COMPONENT_SET' && !variantsControl ? 'Component set' : ''

  function handleTitleActivation(e: MouseEvent) {
    e.stopPropagation()
    onSelect(component.id)
    handleRowClick()
  }

  function handleRowClick() {
    onToggleExpand(component.id)
    if (toggleFocusFrameRef.current !== null) cancelAnimationFrame(toggleFocusFrameRef.current)
    toggleFocusFrameRef.current = requestAnimationFrame(() => {
      rowElementRef.current?.querySelector<HTMLButtonElement>('[data-row-toggle]')?.focus({ preventScroll: true })
      toggleFocusFrameRef.current = null
    })
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (isHidden || isModalOpen) return

    handleRowKeyboardShortcut(event, {
      onGenerate: () => {
        if (!isGenerating) void onGenerate(component)
      },
      onRevert: () => {
        if (component.previousDescription !== undefined) onRevert(component.id)
      },
      onCollapse: isExpanded ? handleRowClick : undefined,
    })
  }

  function renderIconButton() {
    if (!isIcon) return null

    return (
      <button
        type="button"
        className={styles.rowIconButton}
        aria-label={`Turn off icon mode for ${component.name}`}
        title={`Turn off icon mode for ${component.name}`}
        onClick={(e) => {
          e.stopPropagation()
          rowElementRef.current?.querySelector<HTMLButtonElement>('[data-row-toggle]')?.focus({ preventScroll: true })
          onDisableIcon(component.id)
        }}
      >
        Icon
      </button>
    )
  }

  if (!isExpanded) {
    return (
      <div
        className={`${styles.componentRow} ${styles.componentRowCollapsed} ${isSticky ? styles.stickyComponentRow : ''}`}
        ref={(element) => {
          rowElementRef.current = element
        }}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          height: '40px',
          boxSizing: 'border-box',
          cursor: 'pointer',
          transition: 'background-color 0.15s',
        }}
      >
        <button
          type="button"
          data-row-toggle
          className={styles.rowHeaderButton}
          aria-label={`Expand ${component.name}`}
          aria-expanded={false}
          onClick={handleTitleActivation}
        >
          <span title={component.name}>{component.name}</span>
          {relationshipLabel && <span className={styles.rowSetLabel}>{relationshipLabel}</span>}
        </button>

        <span
          style={{
            flex: 1,
            color: isEmpty ? 'var(--figma-color-text-tertiary)' : 'var(--figma-color-text-secondary)',
            fontSize: '12px',
            fontStyle: isEmpty ? 'italic' : 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0
          }}
        >
          {isEmpty ? 'No description' : truncateDescription(component.currentDescription)}
        </span>

        <span
          role={isEmpty ? undefined : 'img'}
          aria-label={isEmpty ? undefined : descriptionStatusLabel}
          aria-hidden={isEmpty ? true : undefined}
          title={isEmpty ? undefined : descriptionStatusLabel}
          style={{ width: '12px', color: 'var(--figma-color-text-secondary)', flexShrink: 0 }}
        >
          {isEmpty ? '' : '✓'}
        </span>

        {(isIcon || variantsControl) && <div className={styles.rowActions}>{renderIconButton()}{variantsControl}</div>}
      </div>
    )
  }

  return (
    <div
      className={`${styles.componentRow} ${isSticky ? styles.stickyComponentRow : ''}`}
      ref={(element) => {
        rowElementRef.current = element
      }}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.rowHeader}>
        <button
          type="button"
          data-row-toggle
          className={styles.rowHeaderButton}
          aria-label={`Collapse ${component.name}`}
          aria-expanded={true}
          onClick={handleTitleActivation}
        >
          <span title={component.name}>{component.name}</span>
          {relationshipLabel && <span className={styles.rowSetLabel}>{relationshipLabel}</span>}
        </button>
        {(isIcon || variantsControl) && <div className={styles.rowActions}>{renderIconButton()}{variantsControl}</div>}
      </div>

      <div className={styles.rowEditor}>
        <textarea
          className={styles.descriptionInput}
          aria-label={`${component.name} description`}
          value={description}
          onInput={(e) => {
            setDescription((e.target as HTMLTextAreaElement).value)
            setIsDirty(true)
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          rows={2}
          placeholder="Enter description..."
          style={{
            width: '100%',
            padding: '8px',
            marginTop: '8px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            lineHeight: '16px',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />

        {(externalError) && (
          <div style={{ color: 'var(--figma-color-text-danger)', marginTop: '4px', fontSize: '11px' }}>
            <div>{externalError.message}</div>
            {externalError.usage?.plan === 'free' && (
              <Button
                secondary
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  onUpgrade()
                }}
                style={{ marginTop: '6px' }}
              >
                Upgrade to Pro
              </Button>
            )}
          </div>
        )}

        {feedbackLabel && (
          <div className={styles.rowFeedback} aria-live="polite">
            {feedbackLabel}
          </div>
        )}

        {(component.type !== 'VARIANT' || component.previousDescription !== undefined) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '8px',
              marginTop: '8px'
            }}
          >
            {component.type === 'COMPONENT_SET' && showVariants && component.variantContext && component.variantContext.length > 0 ? (
              <div className={styles.joinedGenerate} role="group" aria-label={`${component.name} generation actions`}>
                <Button
                  className={styles.joinedGenerateButton}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    void onGenerate(component)
                  }}
                  disabled={isGenerating}
                  aria-label={`Generate a description for ${component.name} only`}
                  title="Generate a description for this component set only. Replaces its existing description."
                >
                  Generate one
                </Button>
                <Button
                  className={styles.joinedGenerateButton}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    void onGenerateComponentSet(component)
                  }}
                  disabled={isGenerating}
                  aria-label={`Generate descriptions for ${component.name} and all variants`}
                  title="Generate descriptions for this component set and all variants. Replaces existing descriptions."
                >
                  Set + variants
                </Button>
              </div>
            ) : component.type !== 'VARIANT' && (
              <Button
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  void onGenerate(component)
                }}
                disabled={isGenerating}
              >
                Generate description
              </Button>
            )}

            {component.previousDescription !== undefined && (
              <Button
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  onRevert(component.id)
                }}
                secondary
              >
                Revert
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
