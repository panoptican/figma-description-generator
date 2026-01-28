import { Button, Text } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import { ComponentData } from '../types'

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
}

const TYPE_COLORS: Record<string, string> = {
  COMPONENT: '#9747FF',
  COMPONENT_SET: '#9747FF',
  VARIANT: '#6B7280'
}

const TYPE_LABELS: Record<string, string> = {
  COMPONENT: 'COMPONENT',
  COMPONENT_SET: 'COMPONENT_SET',
  VARIANT: 'VARIANT'
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
  onCancelRetry
}: ComponentRowProps) {
  const [description, setDescription] = useState(component.currentDescription)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastFromCache, setLastFromCache] = useState<boolean | undefined>(undefined)

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

  const hasDescription = !!component.currentDescription

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

  function handleConfirm() {
    onConfirm(component.id, description)
  }

  function handleReject() {
    setDescription(component.currentDescription)
    onReject(component.id)
    setIsDirty(false)
  }

  function handleNameClick() {
    onSelect(component.id)
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 160px',
        gap: '16px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--figma-color-border)',
        alignItems: 'start'
      }}
    >
      <div
        onClick={handleNameClick}
        style={{ cursor: 'pointer' }}
        title="Click to select in canvas"
      >
        <div
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: TYPE_COLORS[component.type],
            color: 'white',
            fontSize: '10px',
            fontWeight: 600,
            marginBottom: '4px'
          }}
        >
          {TYPE_LABELS[component.type]}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              color: 'var(--figma-color-text-brand)',
              fontSize: '12px',
              textDecoration: 'underline',
              textDecorationColor: 'transparent',
              transition: 'text-decoration-color 0.15s'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.textDecorationColor = 'var(--figma-color-text-brand)'
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.textDecorationColor = 'transparent'
            }}
          >
            {component.name}
          </span>
          {hasDescription && <span style={{ color: 'var(--figma-color-text-success)' }}>✓</span>}
        </div>
        {component.properties.length > 0 && (
          <div style={{ marginTop: '4px', fontSize: '11px' }}>
            <Text>
              <span style={{ color: 'var(--figma-color-text-secondary)' }}>
                {component.properties.join(' | ')}
              </span>
            </Text>
          </div>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <textarea
          value={description}
          onInput={(e) => {
            setDescription((e.target as HTMLTextAreaElement).value)
            setIsDirty(true)
            setError(null)
            setLastFromCache(undefined)
          }}
          rows={4}
          placeholder="Enter description..."
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '6px',
            backgroundColor: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '12px',
            lineHeight: '16px',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        {(error || externalError) && (
          <div style={{ color: 'var(--figma-color-text-danger)', marginTop: '4px', fontSize: '11px' }}>
            {error || externalError}
          </div>
        )}
        {isSaving && (
          <div style={{ color: 'var(--figma-color-text-secondary)', marginTop: '4px', fontSize: '11px' }}>
            Saving…
          </div>
        )}
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
              onClick={() => onCancelRetry(component.id)}
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
        {lastFromCache !== undefined && !isSaving && !error && !externalError && !retryStatus && (
          <div
            style={{
              marginTop: '4px',
              fontSize: '11px',
              color: lastFromCache ? 'var(--figma-color-text-secondary)' : 'var(--figma-color-text-success)'
            }}
            title={lastFromCache ? 'Description was retrieved from cache' : 'Description was freshly generated'}
          >
            {lastFromCache ? 'From cache' : 'Generated'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
        <Button
          onClick={handleGenerate}
          disabled={loading || isGenerating || !hasApiKey}
          loading={loading}
          fullWidth
          style={{ justifyContent: 'center' }}
        >
          Generate
        </Button>

        {component.previousDescription && (
          <Button
            onClick={() => onRevert(component.id)}
            secondary
            fullWidth
          >
            Revert to last
          </Button>
        )}
      </div>
    </div>
  )
}
