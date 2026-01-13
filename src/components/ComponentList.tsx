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
  isGenerating: boolean
  hasApiKey: boolean
  rowErrors: Record<string, string | undefined>
  onSelect: (id: string) => void
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
  onSelect
}: ComponentListProps) {
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())

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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 160px',
          gap: '16px',
          padding: '8px 16px',
          borderBottom: '1px solid var(--figma-color-border)',
          backgroundColor: 'var(--figma-color-bg)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          height: '33px',
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

      {Object.entries(
        components.reduce((acc, component) => {
          if (!acc[component.pageName]) {
            acc[component.pageName] = []
          }
          acc[component.pageName].push(component)
          return acc
        }, {} as Record<string, ComponentData[]>)
      ).map(([pageName, pageComponents]) => {
        const isCollapsed = collapsedPages.has(pageName)
        return (
          <div key={pageName}>
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
                <Muted>({pageComponents.length})</Muted>
              </Text>
            </div>

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
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}
