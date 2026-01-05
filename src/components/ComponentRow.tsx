import {
  Button,
  Muted,
  Text
} from '@create-figma-plugin/ui'
import { Fragment, h } from 'preact'
import { useEffect, useState } from 'preact/hooks'

import { ComponentData } from '../types'

interface ColumnWidths {
  layerName: string
  description: string
  actions: string
}

interface ComponentRowProps {
  component: ComponentData
  onGenerate: (component: ComponentData) => Promise<string>
  onConfirm: (id: string, description: string) => void
  onReject: (id: string) => void
  onSelect: (id: string) => void
  isGenerating: boolean
  hasApiKey: boolean
  columnWidths: ColumnWidths
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
  onSelect,
  isGenerating,
  hasApiKey,
  columnWidths
}: ComponentRowProps) {
  const [description, setDescription] = useState(component.currentDescription)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync description when component prop changes (e.g., from Generate All)
  useEffect(() => {
    setDescription(component.currentDescription)
  }, [component.currentDescription])

  const hasChanges = description !== component.currentDescription
  const isVariant = component.type === 'VARIANT'

  async function handleGenerate() {
    setLoading(true)
    setError(null)
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
  }

  function handleNameClick() {
    onSelect(component.id)
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${columnWidths.layerName} ${columnWidths.description} ${columnWidths.actions}`,
        gap: '16px',
        padding: '16px',
        borderBottom: '1px solid var(--figma-color-border)',
        alignItems: 'start'
      }}
    >
      {/* Layer Name Column - Clickable */}
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
        <div>
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
        </div>
        {component.properties.length > 0 && component.type !== 'VARIANT' && (
          <div style={{ marginTop: '4px', fontSize: '11px' }}>
            <Text>
              <Muted>{component.properties.join(' | ')}</Muted>
            </Text>
          </div>
        )}
      </div>

      {/* Description Column */}
      <div style={{ minWidth: 0 }}>
        <textarea
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          rows={4}
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
        {error && (
          <div style={{ color: 'var(--figma-color-text-danger)', marginTop: '4px', fontSize: '11px' }}>
            {error}
          </div>
        )}
      </div>

      {/* Actions Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Button
          onClick={handleGenerate}
          disabled={loading || isGenerating || !hasApiKey}
          loading={loading}
          fullWidth
        >
          Generate
        </Button>

        {hasChanges && (
          <Fragment>
            <Button
              onClick={handleConfirm}
              fullWidth
            >
              Confirm
            </Button>
            <Button
              onClick={handleReject}
              secondary
              fullWidth
              danger
            >
              Reject
            </Button>
          </Fragment>
        )}
      </div>
    </div>
  )
}
