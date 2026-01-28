import { Muted, Text } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useState } from 'preact/hooks'

import { AIProvider, ComponentData } from '../types'
import { ComponentRow } from './ComponentRow'

interface RetryStatus {
  attempt: number
  maxAttempts: number
}

interface ComponentListProps {
  components: ComponentData[]
  onGenerate: (component: ComponentData) => Promise<string>
  onConfirm: (id: string, description: string) => void
  onReject: (id: string) => void
  onRevert: (id: string) => void
  isGenerating: boolean
  hasApiKey: boolean
  rowErrors: Record<string, string | undefined>
  cacheHits: Record<string, boolean>
  retryStatus: Record<string, RetryStatus | undefined>
  onSelect: (id: string) => void
  onCancelRetry: (id: string) => void
  usedProvider: Record<string, AIProvider | undefined>
}

export function ComponentList({
  components,
  onGenerate,
  onConfirm,
  onReject,
  onRevert,
  isGenerating,
  hasApiKey,
  rowErrors,
  cacheHits,
  retryStatus,
  onSelect,
  onCancelRetry,
  usedProvider
}: ComponentListProps) {
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  if (components.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text>
          <Muted>No components found in this document</Muted>
        </Text>
      </div>
    )
  }

  function handleToggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Group components by page
  const componentsByPage = components.reduce((acc, component) => {
    if (!acc[component.pageName]) {
      acc[component.pageName] = []
    }
    acc[component.pageName].push(component)
    return acc
  }, {} as Record<string, ComponentData[]>)

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 0 }}>
      {Object.entries(componentsByPage).map(([pageName, pageComponents]) => {
        const isCollapsed = collapsedPages.has(pageName)
        const completedCount = pageComponents.filter(c => !!c.currentDescription).length
        const totalCount = pageComponents.length
        const isComplete = completedCount === totalCount

        return (
          <div key={pageName}>
            {/* Page header */}
            <div
              onClick={() =>
                setCollapsedPages((prev) => {
                  const next = new Set(prev)
                  next.has(pageName) ? next.delete(pageName) : next.add(pageName)
                  return next
                })
              }
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--figma-color-bg-secondary)',
                borderBottom: '1px solid var(--figma-color-border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                userSelect: 'none'
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                  fontSize: '10px',
                  color: 'var(--figma-color-text-secondary)'
                }}
              >
                ▼
              </span>
              <Text>
                <Text style={{ fontWeight: 600 }}>Page: {pageName}</Text>
              </Text>
              <Text>
                <span
                  style={{
                    color: isComplete
                      ? 'var(--figma-color-text-success)'
                      : completedCount > 0
                        ? 'var(--figma-color-text-warning)'
                        : 'var(--figma-color-text-secondary)'
                  }}
                >
                  ({completedCount}/{totalCount})
                </span>
              </Text>
              {isComplete && (
                <span style={{ color: 'var(--figma-color-text-success)', marginLeft: 'auto' }}>✓</span>
              )}
            </div>

            {/* Component rows */}
            {!isCollapsed &&
              pageComponents.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  onGenerate={onGenerate}
                  onConfirm={onConfirm}
                  onReject={onReject}
                  onRevert={onRevert}
                  onSelect={onSelect}
                  isGenerating={isGenerating}
                  hasApiKey={hasApiKey}
                  externalError={rowErrors[component.id]}
                  fromCache={cacheHits[component.id]}
                  retryStatus={retryStatus[component.id]}
                  onCancelRetry={onCancelRetry}
                  usedProvider={usedProvider[component.id]}
                  isExpanded={expandedRows.has(component.id)}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}
