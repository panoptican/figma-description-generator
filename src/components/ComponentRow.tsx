import { Button } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { ComponentData } from '../types'

interface ComponentRowProps {
  component: ComponentData
  onGenerate: (component: ComponentData) => Promise<string>
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
}

const TYPE_LABELS: Record<string, string> = {
  COMPONENT: 'Component',
  COMPONENT_SET: 'Component Set',
  VARIANT: 'Variant'
}

function truncateDescription(text: string | undefined, maxLength: number = 60): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

export function ComponentRow({
  component,
  onGenerate,
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
  onToggleIcon
}: ComponentRowProps) {
  const [description, setDescription] = useState(component.currentDescription)
  const [loading, setLoading] = useState(false)
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

  const hasDescription = !!component.currentDescription
  const isEmpty = !hasDescription
  const collapsedBackgroundColor = isSelected
    ? 'rgba(24, 160, 251, 0.12)'
    : isEmpty
      ? 'rgba(245, 158, 11, 0.08)'
      : 'transparent'
  const collapsedHoverBackgroundColor = isSelected
    ? 'rgba(24, 160, 251, 0.18)'
    : isEmpty
      ? 'rgba(245, 158, 11, 0.14)'
      : 'var(--figma-color-bg-hover)'
  const sourceLabel = isIcon ? 'Icon prompt' : component.type === 'VARIANT' ? 'Variant prompt' : 'Default prompt'
  const statusLabel =
    error || externalError
      ? 'Error'
      : loading || isGenerating
        ? 'Generating...'
        : isSaving
          ? 'Saving...'
          : isDirty
            ? 'Unsaved changes'
            : isEmpty
              ? 'Missing description'
              : 'Ready'

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const newDescription = await onGenerate(component)
      setDescription(newDescription)
      onConfirm(component.id, newDescription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate')
    } finally {
      setLoading(false)
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
  const typeAndProps = propertiesStr
    ? `${TYPE_LABELS[component.type]} · ${propertiesStr}`
    : TYPE_LABELS[component.type]

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
          padding: '8px 16px',
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
        {isEmpty && (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
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
        padding: '12px 16px',
        borderBottom: '1px solid var(--figma-color-border)',
        backgroundColor: isSelected ? 'rgba(24, 160, 251, 0.1)' : 'var(--figma-color-bg-secondary)'
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
          <Button
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              handleGenerate()
            }}
            disabled={loading || isGenerating || !hasApiKey}
            loading={loading}
          >
            Generate
          </Button>

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
