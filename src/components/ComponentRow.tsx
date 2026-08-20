import { Button } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { ComponentData } from '../types'
import { getDescriptionStatus } from '../utils/descriptionStatus'

interface ComponentRowProps {
  component: ComponentData
  onGenerate: (component: ComponentData) => Promise<string>
  onGenerateComponentSet: (component: ComponentData) => Promise<void>
  onGenerated: (id: string) => void
  onConfirm: (id: string, description: string) => void
  onReject: (id: string) => void
  onRevert: (id: string) => void
  onSelect: (id: string) => void
  isSelected: boolean
  onRowSelect: (id: string) => void
  isGenerating: boolean
  hasApiKey: boolean
  providerLabel: string
  externalError?: string
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  isIcon: boolean
  onToggleIcon: (id: string) => void
  wasGeneratedThisSession: boolean
}

function truncateDescription(text: string | undefined, maxLength: number = 60): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

export function ComponentRow({
  component,
  onGenerate,
  onGenerateComponentSet,
  onConfirm,
  onReject,
  onRevert,
  onSelect,
  isSelected,
  onRowSelect,
  isGenerating,
  hasApiKey,
  providerLabel,
  externalError,
  isExpanded,
  onToggleExpand,
  isIcon,
  onToggleIcon,
  onGenerated,
  wasGeneratedThisSession
}: ComponentRowProps) {
  const [description, setDescription] = useState(component.currentDescription)
  const [loading, setLoading] = useState(false)
  const [groupLoading, setGroupLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDescription(component.currentDescription)
    setIsDirty(false)
    setIsSaving(false)
  }, [component.currentDescription])

  useEffect(() => {
    if (!isDirty || description === component.currentDescription) {
      return
    }

    const timeout = setTimeout(() => {
      setIsSaving(true)
      onConfirm(component.id, description)
      setIsDirty(false)
    }, 800)

    return () => clearTimeout(timeout)
  }, [description, isDirty, component.currentDescription, component.id, onConfirm])

  // Handle Escape key to collapse
  useEffect(() => {
    if (!isExpanded) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onToggleExpand(component.id)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, component.id, onToggleExpand])

  // Collapse when clicking outside the expanded row.
  useEffect(() => {
    if (!isExpanded) return

    function handleClickOutside(e: MouseEvent) {
      if (rowRef.current === null) {
        return
      }
      const target = e.target as Node | null
      if (target !== null && !rowRef.current.contains(target)) {
        onToggleExpand(component.id)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded, component.id, onToggleExpand])

  const descriptionStatus = getDescriptionStatus(component.currentDescription, wasGeneratedThisSession)
  const isEmpty = descriptionStatus === 'missing'
  const statusColor = descriptionStatus === 'generated'
    ? '#f59e0b'
    : descriptionStatus === 'existing'
      ? '#22c55e'
      : 'transparent'
  const collapsedBackgroundColor = isSelected
    ? 'rgba(24, 160, 251, 0.12)'
    : descriptionStatus === 'generated'
      ? 'rgba(245, 158, 11, 0.08)'
      : descriptionStatus === 'existing'
        ? 'rgba(34, 197, 94, 0.06)'
        : 'transparent'
  const collapsedHoverBackgroundColor = isSelected
    ? 'rgba(24, 160, 251, 0.18)'
    : descriptionStatus === 'generated'
      ? 'rgba(245, 158, 11, 0.14)'
      : descriptionStatus === 'existing'
        ? 'rgba(34, 197, 94, 0.1)'
        : 'var(--figma-color-bg-hover)'
  const expandedBackgroundColor = isSelected
    ? 'rgba(24, 160, 251, 0.1)'
    : descriptionStatus === 'generated'
      ? 'rgba(245, 158, 11, 0.08)'
      : descriptionStatus === 'existing'
        ? 'rgba(34, 197, 94, 0.06)'
        : 'var(--figma-color-bg-secondary)'
  const sourceLabel = isIcon ? 'Icon prompt' : component.type === 'VARIANT' ? 'Variant set prompt' : 'Default prompt'
  const statusLabel =
    error || externalError
      ? 'Error'
      : loading || groupLoading || isGenerating
        ? 'Generating...'
        : isSaving
          ? 'Saving...'
          : isDirty
            ? 'Unsaved changes'
            : descriptionStatus === 'generated'
              ? 'Generated this session'
              : isEmpty
                ? 'Missing description'
                : 'Ready'

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const newDescription = await onGenerate(component)
      setDescription(newDescription)
      onGenerated(component.id)
      onConfirm(component.id, newDescription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateComponentSet() {
    setGroupLoading(true)
    setError(null)
    try {
      await onGenerateComponentSet(component)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate component set')
    } finally {
      setGroupLoading(false)
    }
  }

  function handleNameClick(e: MouseEvent) {
    e.stopPropagation()
    onRowSelect(component.id)
    onSelect(component.id)
  }

  function handleRowClick() {
    onToggleExpand(component.id)
  }

  // Build properties string for expanded view
  const propertiesStr = component.properties.length > 0 ? component.properties.join(', ') : ''
  const relationshipLabel =
    component.type === 'COMPONENT_SET'
      ? 'Component set'
      : component.type === 'VARIANT'
        ? `Variant of ${component.parentName || 'component set'}`
        : 'Component'
  const typeAndProps = propertiesStr ? `${relationshipLabel} · ${propertiesStr}` : relationshipLabel

  // Collapsed state - single line
  if (!isExpanded) {
    return (
      <div
        ref={rowRef}
        onClick={handleRowClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: component.type === 'VARIANT' ? '8px 16px 8px 32px' : '8px 16px',
          height: '36px',
          boxSizing: 'border-box',
          borderBottom: '1px solid var(--figma-color-border)',
          cursor: 'pointer',
          backgroundColor: collapsedBackgroundColor,
          transition: 'background-color 0.15s'
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = collapsedHoverBackgroundColor
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = collapsedBackgroundColor
        }}
      >
        {/* Status dot */}
        {!isEmpty && (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              flexShrink: 0
            }}
          />
        )}

        {/* Component name */}
        <span
          onClick={handleNameClick}
          style={{
            color: 'var(--figma-color-text)',
            fontSize: '12px',
            fontWeight: 500,
            flexShrink: 0,
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={component.name}
        >
          {component.name}
        </span>

        {/* Component hierarchy */}
        <span
          title={component.type === 'VARIANT' ? relationshipLabel : undefined}
          style={{
            maxWidth: '190px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            padding: '1px 5px',
            borderRadius: '3px',
            backgroundColor: component.type === 'VARIANT'
              ? 'var(--figma-color-bg-secondary)'
              : 'transparent',
            color: 'var(--figma-color-text-tertiary)',
            flexShrink: 0
          }}
        >
          {relationshipLabel}
        </span>

        {/* Icon badge */}
        {isIcon && (
          <span
            title="Icon component — uses icon prompt"
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '3px',
              backgroundColor: 'var(--figma-color-bg-tertiary)',
              color: 'var(--figma-color-text-secondary)',
              flexShrink: 0,
              lineHeight: '14px'
            }}
          >
            Icon
          </span>
        )}

        {/* Description preview or empty indicator */}
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

        {/* Expand indicator */}
        <span
          style={{
            color: 'var(--figma-color-text-tertiary)',
            fontSize: '12px',
            flexShrink: 0
          }}
        >
          ›
        </span>
      </div>
    )
  }

  // Expanded state - full details
  return (
    <div
      ref={rowRef}
      style={{
        padding: component.type === 'VARIANT' ? '12px 16px 12px 32px' : '12px 16px',
        borderBottom: '1px solid var(--figma-color-border)',
        backgroundColor: expandedBackgroundColor
      }}
    >
      {/* Header row - name and collapse indicator */}
      <div
        onClick={handleRowClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: '4px'
        }}
      >
        <span
          onClick={handleNameClick}
          style={{
            color: 'var(--figma-color-text)',
            fontSize: '13px',
            fontWeight: 600
          }}
          title="Click to select in canvas"
        >
          {component.name}
        </span>
        <span
          style={{
            color: 'var(--figma-color-text-tertiary)',
            fontSize: '12px',
            transform: 'rotate(90deg)'
          }}
        >
          ›
        </span>
      </div>

      {/* Type, properties, and icon toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}
      >
        <span style={{ color: 'var(--figma-color-text-secondary)', fontSize: '11px' }}>
          {typeAndProps}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleIcon(component.id)
          }}
          title={isIcon ? 'Using icon prompt (click to disable)' : 'Click to use icon prompt'}
          style={{
            padding: '1px 6px',
            borderRadius: '3px',
            border: isIcon ? 'none' : '1px dashed var(--figma-color-border)',
            backgroundColor: isIcon ? 'var(--figma-color-bg-brand)' : 'transparent',
            color: isIcon ? 'var(--figma-color-text-onbrand)' : 'var(--figma-color-text-tertiary)',
            fontSize: '10px',
            cursor: 'pointer',
            lineHeight: '14px'
          }}
        >
          Icon
        </button>
      </div>

      {/* Textarea - 2 lines default */}
      <textarea
        value={description}
        onInput={(e) => {
          setDescription((e.target as HTMLTextAreaElement).value)
          setIsDirty(true)
          setError(null)
        }}
        onClick={(e) => e.stopPropagation()}
        rows={2}
        placeholder="Enter description..."
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid var(--figma-color-border)',
          borderRadius: '4px',
          backgroundColor: 'var(--figma-color-bg)',
          color: 'var(--figma-color-text)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '12px',
          lineHeight: '16px',
          resize: 'vertical',
          boxSizing: 'border-box'
        }}
      />

      {/* Error display */}
      {(error || externalError) && (
        <div style={{ color: 'var(--figma-color-text-danger)', marginTop: '4px', fontSize: '11px' }}>
          {error || externalError}
        </div>
      )}

      {/* Status and action buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          marginTop: '8px'
        }}
      >
        <span
          style={{
            color: 'var(--figma-color-text-tertiary)',
            fontSize: '11px',
            lineHeight: '14px',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={`Source: ${sourceLabel} · Provider: ${providerLabel} · Status: ${statusLabel}`}
        >
          {`Source: ${sourceLabel} · Provider: ${providerLabel} · Status: ${statusLabel}`}
        </span>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {component.type !== 'VARIANT' && (
            <Button
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                handleGenerate()
              }}
              disabled={loading || groupLoading || isGenerating || !hasApiKey}
              loading={loading}
            >
              {component.type === 'COMPONENT_SET' ? 'Generate parent' : 'Generate'}
            </Button>
          )}

          {component.type === 'COMPONENT_SET' && component.variantContext && component.variantContext.length > 0 && (
            <Button
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                handleGenerateComponentSet()
              }}
              disabled={groupLoading || loading || isGenerating || !hasApiKey}
              loading={groupLoading}
              title="Generate descriptions for this parent and every variant"
              secondary
            >
              Generate set
            </Button>
          )}

          {component.type === 'VARIANT' && (
            <span
              style={{
                color: 'var(--figma-color-text-tertiary)',
                fontSize: '11px',
                alignSelf: 'center'
              }}
            >
              Generate from “{component.parentName || 'component set'}”
            </span>
          )}

          {component.previousDescription && (
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
      </div>
    </div>
  )
}
