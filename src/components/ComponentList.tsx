import { Muted, Text } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useState } from 'preact/hooks'

import { ComponentData } from '../types'
import { ComponentRow } from './ComponentRow'

interface ComponentListProps {
  components: ComponentData[]
  onGenerate: (component: ComponentData) => Promise<string>
  onConfirm: (id: string, description: string) => void
  onReject: (id: string) => void
  onRevert: (id: string) => void
  selectedRowId: string | null
  onRowSelect: (id: string) => void
  isGenerating: boolean
  hasApiKey: boolean
  providerLabel: string
  rowErrors: Record<string, string | undefined>
  onSelect: (id: string) => void
  iconOverrides: Record<string, boolean>
  onToggleIcon: (id: string) => void
}

export function ComponentList({
  components,
  onGenerate,
  onConfirm,
  onReject,
  onRevert,
  selectedRowId,
  onRowSelect,
  isGenerating,
  hasApiKey,
  providerLabel,
  rowErrors,
  onSelect,
  iconOverrides,
  onToggleIcon
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
    onRowSelect(id)
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

  function handleExpandAllInPage(pageComponents: ComponentData[]) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      pageComponents.forEach(c => next.add(c.id))
      return next
    })
  }

  function handleCollapseAllInPage(pageComponents: ComponentData[]) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      pageComponents.forEach(c => next.delete(c.id))
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

        // Check if all rows in this page are expanded
        const allRowsExpanded = pageComponents.every(c => expandedRows.has(c.id))

        return (
          <div key={pageName}>
            {/* Page header */}
            <div
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--figma-color-bg-secondary)',
                borderBottom: '1px solid var(--figma-color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                userSelect: 'none',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}
            >
              {/* Clickable area for collapse/expand page */}
              <div
                onClick={() =>
                  setCollapsedPages((prev) => {
                    const next = new Set(prev)
                    next.has(pageName) ? next.delete(pageName) : next.add(pageName)
                    return next
                  })
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  flex: 1
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
              </div>

              {/* Expand All / Collapse All button or checkmark */}
              {isComplete ? (
                <span style={{ color: 'var(--figma-color-text-success)' }}>✓</span>
              ) : !isCollapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (allRowsExpanded) {
                      handleCollapseAllInPage(pageComponents)
                    } else {
                      handleExpandAllInPage(pageComponents)
                    }
                  }}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--figma-color-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--figma-color-text-secondary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {allRowsExpanded ? 'Collapse All' : 'Expand All'}
                </button>
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
                  isSelected={selectedRowId === component.id}
                  onRowSelect={onRowSelect}
                  isGenerating={isGenerating}
                  hasApiKey={hasApiKey}
                  providerLabel={providerLabel}
                  externalError={rowErrors[component.id]}
                  isExpanded={expandedRows.has(component.id)}
                  onToggleExpand={handleToggleExpand}
                  isIcon={iconOverrides[component.id] ?? component.isIcon ?? false}
                  onToggleIcon={onToggleIcon}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}
