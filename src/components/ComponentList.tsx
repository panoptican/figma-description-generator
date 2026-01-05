import { Bold, Muted, Text } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import { Fragment, h } from 'preact'

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
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
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
      {Object.entries(groupedByPage).map(([pageName, pageComponents]) => (
        <Fragment key={pageName}>
          {/* Page Header - Sticky below the main header */}
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--figma-color-bg-secondary)',
              borderBottom: '1px solid var(--figma-color-border)',
              position: 'sticky',
              top: `${HEADER_HEIGHT}px`
            }}
          >
            <Text>
              <Bold>Page: {pageName}</Bold>
            </Text>
          </div>

          {/* Components in this page */}
          {pageComponents.map((component) => (
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
      ))}
    </div>
  )
}
