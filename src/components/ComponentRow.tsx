import { Button, Text } from '@create-figma-plugin/ui'
import { Fragment, h } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { AIProvider, ComponentData } from '../types'
import { getProviderDisplayName } from '../services/ai'

interface RetryStatus {
  attempt: number
  maxAttempts: number
}

interface ComponentRowProps {
  component: ComponentData
  onGenerate: (component: ComponentData) => Promise<string>
  onConfirm: (id: string, description: string) => void
  onReject: (id: string) => void
  onRevert: (id: string) => void
  onSelect: (id: string) => void
  isGenerating: boolean
  hasApiKey: boolean
  externalError?: string
  fromCache?: boolean
  retryStatus?: RetryStatus
  onCancelRetry: (id: string) => void
  usedProvider?: AIProvider
  isExpanded: boolean
  onToggleExpand: (id: string) => void
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
  isGenerating,
  hasApiKey,
  externalError,
  fromCache,
  retryStatus,
  onCancelRetry,
  usedProvider,
  isExpanded,
  onToggleExpand
}: ComponentRowProps) {
  const [description, setDescription] = useState(component.currentDescription)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastFromCache, setLastFromCache] = useState<boolean | undefined>(undefined)
  const [lastUsedProvider, setLastUsedProvider] = useState<AIProvider | undefined>(undefined)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDescription(component.currentDescription)
    setIsDirty(false)
    setIsSaving(false)
  }, [component.currentDescription])

  useEffect(() => {
    if (fromCache !== undefined) {
      setLastFromCache(fromCache)
    }
  }, [fromCache])

  useEffect(() => {
    if (usedProvider !== undefined) {
      setLastUsedProvider(usedProvider)
    }
  }, [usedProvider])

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

  const hasDescription = !!component.currentDescription
  const isEmpty = !hasDescription

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setLastFromCache(undefined)
    try {
      const newDescription = await onGenerate(component)
      setDescription(newDescription)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  function handleNameClick(e: MouseEvent) {
    e.stopPropagation()
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

  // Status text for expanded view
  const getStatusText = () => {
    if (isSaving) return 'Saving...'
    if (error || externalError) return null
    if (retryStatus) return null
    if (lastFromCache === true) return 'From cache'
    if (lastFromCache === false) {
      return lastUsedProvider
        ? `Generated via ${getProviderDisplayName(lastUsedProvider)}`
        : 'Generated'
    }
    return null
  }

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
          backgroundColor: isEmpty ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
          transition: 'background-color 0.15s'
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = isEmpty
            ? 'rgba(251, 191, 36, 0.15)'
            : 'var(--figma-color-bg-hover)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = isEmpty
            ? 'rgba(251, 191, 36, 0.08)'
            : 'transparent'
        }}
      >
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

        {/* Description preview */}
        <span
          style={{
            flex: 1,
            color: 'var(--figma-color-text-secondary)',
            fontSize: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0
          }}
        >
          {truncateDescription(component.currentDescription)}
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
        backgroundColor: 'var(--figma-color-bg-secondary)'
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

      {/* Type and properties as muted text */}
      <div
        style={{
          color: 'var(--figma-color-text-secondary)',
          fontSize: '11px',
          marginBottom: '8px'
        }}
      >
        {typeAndProps}
      </div>

      {/* Textarea - 2 lines default */}
      <textarea
        value={description}
        onInput={(e) => {
          setDescription((e.target as HTMLTextAreaElement).value)
          setIsDirty(true)
          setError(null)
          setLastFromCache(undefined)
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

      {/* Retry status */}
      {retryStatus && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '11px',
            color: 'var(--figma-color-text-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>Retrying... attempt {retryStatus.attempt}/{retryStatus.maxAttempts}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCancelRetry(component.id)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--figma-color-text-danger)',
              cursor: 'pointer',
              padding: '0',
              fontSize: '11px',
              textDecoration: 'underline'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Footer row - status text left, buttons right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '8px',
          gap: '12px'
        }}
      >
        {/* Status text */}
        <div
          style={{
            fontSize: '11px',
            color: isSaving
              ? 'var(--figma-color-text-secondary)'
              : lastFromCache === true
                ? 'var(--figma-color-text-secondary)'
                : 'var(--figma-color-text-success)',
            flex: 1
          }}
        >
          {getStatusText()}
        </div>

        {/* Action buttons */}
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
