import { Bold, Muted, Text } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import { Fragment, h } from 'preact'
import { useState } from 'preact/hooks'

import { ComponentData, SelectComponentHandler } from '../types'
import { ComponentRow } from './ComponentRow'

interface ComponentListProps {
  components: ComponentData[]
  onGenerate: (component: ComponentData) => Promise<string>
  onConfirm: (id: string, description: string) => void
  onReject: (id: string) => void
  isGenerating: boolean
  hasApiKey: boolean
}

const HEADER_HEIGHT = 33
const COLUMN_WIDTHS = {
  layerName: '240px',
  description: '1fr',
  actions: '140px'
}

export function ComponentList({
  components,
  onGenerate,
  onConfirm,
  onReject,
  isGenerating,
  hasApiKey
}: ComponentListProps) {
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())

  // Group components by page
  const groupedByPage = components.reduce((acc, component) => {
    if (!acc[component.pageName]) {
      acc[component.pageName] = []
    }
    acc[component.pageName].push(component)
    return acc
  }, {} as Record<string, ComponentData[]>)

  const handleSelectComponent = (id: string) => {
    emit<SelectComponentHandler>('SELECT_COMPONENT', { id })
  }

  const togglePageCollapse = (pageName: string) => {
    setCollapsedPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageName)) {
        next.delete(pageName)
      } else {
        next.add(pageName)
      }
      return next
    })
  }

  if (components.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text>
          <Muted>No components found in this document</Muted>
        </Text>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 0 }}>
      {/* Header Row - Fixed with solid background */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${COLUMN_WIDTHS.layerName} ${COLUMN_WIDTHS.description} ${COLUMN_WIDTHS.actions}`,
          gap: '16px',
          padding: '8px 16px',
          borderBottom: '1px solid var(--figma-color-border)',
          backgroundColor: 'var(--figma-color-bg)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          height: `${HEADER_HEIGHT}px`,
          boxSizing: 'border-box',
          alignItems: 'center'
        }}
      >
        <Text>
          <Muted>Layer Name</Muted>
        </Text>
        <Text>
          <Muted>Description</Muted>
        </Text>
        <Text>
          <Muted>Actions</Muted>
        </Text>
      </div>

      {/* Component Rows Grouped by Page */}
      {Object.entries(groupedByPage).map(([pageName, pageComponents]) => {
        const isCollapsed = collapsedPages.has(pageName)
        return (
          <Fragment key={pageName}>
            {/* Page Header - Sticky below the main header, clickable to collapse */}
            <div
              onClick={() => togglePageCollapse(pageName)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--figma-color-bg-secondary)',
                borderBottom: '1px solid var(--figma-color-border)',
                position: 'sticky',
                top: `${HEADER_HEIGHT}px`,
                zIndex: 1,
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
                <Bold>Page: {pageName}</Bold>
              </Text>
              <Text>
                <Muted>({pageComponents.length})</Muted>
              </Text>
            </div>

            {/* Components in this page */}
            {!isCollapsed &&
              pageComponents.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  onGenerate={onGenerate}
                  onConfirm={onConfirm}
                  onReject={onReject}
                  onSelect={handleSelectComponent}
                  isGenerating={isGenerating}
                  hasApiKey={hasApiKey}
                  columnWidths={COLUMN_WIDTHS}
                />
              ))}
          </Fragment>
        )
      })}
    </div>
  )
}
