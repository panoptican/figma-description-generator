import { Muted, Text } from '@create-figma-plugin/ui'
import { ComponentChildren, h } from 'preact'
import { useState } from 'preact/hooks'

import { ComponentData, Scope } from '../types'
import { ComponentGroup, groupComponentRows } from '../utils/componentGroups'
import { isIconModeEnabled } from '../utils/icon'
import styles from '../ui.css'
import { isDescriptionEmpty } from '../utils/text'
import { GenerationError } from '../services/generationRunner'
import { ComponentRow } from './ComponentRow'

interface ComponentListProps {
  components: ComponentData[]
  pageGeneration?: {
    counts: Map<string, number>
    activePageId: string | null
    progress: { current: number; total: number }
    overwriteExisting: boolean
    isRefreshing: boolean
    onGenerate: (pageId: string) => Promise<void>
    onCancel: () => void
  }
  searchValue: string
  scope: Scope
  showVariants: boolean
  isModalOpen?: boolean
  onGenerate: (component: ComponentData) => Promise<void>
  onGenerateComponentSet: (component: ComponentData) => Promise<void>
  onConfirm: (id: string, description: string) => void
  onRevert: (id: string) => void
  isGenerating: boolean
  rowErrors: Record<string, GenerationError | undefined>
  onSelect: (id: string) => void
  iconOverrides: Record<string, boolean>
  onDisableIcon: (id: string) => void
  generatedThisSession: Set<string>
  onUpgrade: () => void
  pendingIds: Set<string>
}

export function ComponentList({
  components,
  pageGeneration,
  searchValue,
  scope,
  isModalOpen = false,
  showVariants,
  onGenerate,
  onGenerateComponentSet,
  onConfirm,
  onRevert,
  isGenerating,
  rowErrors,
  onSelect,
  iconOverrides,
  onDisableIcon,
  generatedThisSession,
  onUpgrade,
  pendingIds
}: ComponentListProps) {
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set())
  const [collapsedVariantGroups, setCollapsedVariantGroups] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  if (components.length === 0) {
    const emptyMessage = searchValue
      ? `No matches for “${searchValue}”.`
      : scope === 'current-page'
        ? 'No components on this page. Close and run Entire file to scan the whole file.'
        : 'No components in this file.'

    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Text>
          <Muted>{emptyMessage}</Muted>
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

  function handleExpandAllInPage(pageComponents: ComponentData[]) {
    setCollapsedVariantGroups((prev) => {
      const next = new Set(prev)
      groupComponentRows(pageComponents).forEach(group => next.delete(group.id))
      return next
    })
    setExpandedRows((prev) => {
      const next = new Set(prev)
      pageComponents.forEach(c => next.add(c.id))
      return next
    })
  }

  function handleCollapseAllInPage(pageComponents: ComponentData[]) {
    setCollapsedVariantGroups((prev) => {
      const next = new Set(prev)
      groupComponentRows(pageComponents).forEach(group => {
        if (group.variants.length > 0) next.add(group.id)
      })
      return next
    })
    setExpandedRows((prev) => {
      const next = new Set(prev)
      pageComponents.forEach(c => next.delete(c.id))
      return next
    })
  }

  // Group components by page
  const componentsByPage = components.reduce((acc, component) => {
    if (!acc[component.pageId]) {
      acc[component.pageId] = []
    }
    acc[component.pageId].push(component)
    return acc
  }, {} as Record<string, ComponentData[]>)

  function renderVariantsToggle(group: ComponentGroup) {
    if (group.variants.length === 0) return null
    const expanded = !collapsedVariantGroups.has(group.id)
    const label = `${group.variants.length} ${group.variants.length === 1 ? 'variant' : 'variants'}`
    return (
      <button
        type="button"
        className={styles.variantsToggle}
        aria-label={`${expanded ? 'Hide' : 'Show'} ${label} of ${group.component?.name || group.parentName}`}
        aria-expanded={expanded}
        aria-controls={`variants-${group.id}`}
        onClick={(event) => {
          event.stopPropagation()
          setCollapsedVariantGroups(previous => {
            const next = new Set(previous)
            next.has(group.id) ? next.delete(group.id) : next.add(group.id)
            return next
          })
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>
          <path d="m3.5 2 3 3-3 3" />
        </svg>
        {label}
      </button>
    )
  }

  function renderRow(component: ComponentData, options: { isHidden?: boolean; isSticky?: boolean; variantsControl?: ComponentChildren } = {}) {
    return (
      <ComponentRow
        key={component.id}
        component={component}
        showVariants={showVariants}
        isModalOpen={isModalOpen}
        isHidden={options.isHidden}
        isSticky={options.isSticky}
        variantsControl={options.variantsControl}
        onGenerate={onGenerate}
        onGenerateComponentSet={onGenerateComponentSet}
        onConfirm={onConfirm}
        onRevert={onRevert}
        onSelect={onSelect}
        isGenerating={isGenerating}
        externalError={rowErrors[component.id]}
        isExpanded={expandedRows.has(component.id)}
        onToggleExpand={handleToggleExpand}
        isIcon={isIconModeEnabled(component.isIcon, iconOverrides[component.id])}
        onDisableIcon={onDisableIcon}
        wasGeneratedThisSession={generatedThisSession.has(component.id)}
        onUpgrade={onUpgrade}
        isPending={pendingIds.has(component.id)}
      />
    )
  }

  return (
    <div className={styles.componentList} style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', zIndex: 0 }}>
      {Object.entries(componentsByPage).map(([pageId, pageComponents]) => {
        const pageName = pageComponents[0].pageName
        const isCollapsed = collapsedPages.has(pageId)
        const completedCount = pageComponents.filter((c) => !isDescriptionEmpty(c.currentDescription)).length
        const totalCount = pageComponents.length
        const isComplete = completedCount === totalCount
        const pageGroups = groupComponentRows(pageComponents)
        const pageGenerateCount = pageGeneration?.counts.get(pageId) || 0
        const isGeneratingPage = isGenerating && pageGeneration?.activePageId === pageId
        const pageGenerateLabel = pageGeneration?.overwriteExisting ? `Replace ${pageGenerateCount}` : `Fill ${pageGenerateCount}`
        const pageGenerateTitle = pageGenerateCount === 0
            ? 'Nothing to generate on this page with the current filters'
            : pageGeneration?.overwriteExisting
              ? `Replace targeted descriptions on “${pageName}”`
              : `Fill missing descriptions on “${pageName}”. Skips existing descriptions.`

        // Check if all rows in this page are expanded
        const allRowsExpanded = pageComponents.every(c => expandedRows.has(c.id)) &&
          pageGroups.every(group => group.variants.length === 0 || !collapsedVariantGroups.has(group.id))

        return (
          <div key={pageId}>
            {/* Page header */}
            <div
              className={styles.pageHeader}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--figma-color-bg-secondary)',
                borderBottom: '1px solid var(--figma-color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                userSelect: 'none',
              }}
            >
              {/* Clickable area for collapse/expand page */}
              <div
                onClick={() =>
                  setCollapsedPages((prev) => {
                    const next = new Set(prev)
                    next.has(pageId) ? next.delete(pageId) : next.add(pageId)
                    return next
                  })
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    fontSize: '10px',
                    flexShrink: 0,
                    color: 'var(--figma-color-text-secondary)'
                  }}
                >
                  ▼
                </span>
                <span title={pageName} style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  Page: {pageName}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    color: isComplete
                      ? 'var(--figma-color-text-success)'
                      : completedCount > 0
                        ? 'var(--figma-color-text-warning)'
                        : 'var(--figma-color-text-secondary)'
                  }}
                >
                  {completedCount} of {totalCount} described
                </span>
              </div>

              {pageGeneration && (
                <button
                  type="button"
                  className={styles.pageGenerateButton}
                  disabled={!isGeneratingPage && (isGenerating || pageGeneration.isRefreshing || pageGenerateCount === 0)}
                  title={isGeneratingPage ? 'Stop remaining generation on this page. Already-written descriptions stay.' : pageGenerateTitle}
                  aria-label={isGeneratingPage ? `Stop generation on ${pageName}` : `${pageGenerateLabel} descriptions on ${pageName}`}
                  onClick={() => {
                    if (isGeneratingPage) {
                      pageGeneration.onCancel()
                    } else {
                      void pageGeneration.onGenerate(pageId)
                    }
                  }}
                >
                  {isGeneratingPage
                    ? `Stop (${pageGeneration.progress.current}/${pageGeneration.progress.total})`
                    : pageGenerateLabel}
                </button>
              )}

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
                    flexShrink: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {allRowsExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              )}
            </div>

            {/* Component rows */}
            {!isCollapsed && (
              <div className={styles.componentPageRows}>
                {pageGroups.map((group) => (
                  <div
                    key={group.id}
                    className={styles.componentGroup}
                    role="group"
                    aria-label={group.component?.name || group.parentName}
                  >
                    {group.component ? renderRow(group.component, { isSticky: group.variants.length > 0, variantsControl: renderVariantsToggle(group) }) : (
                      <div className={`${styles.componentSetContext} ${styles.stickyComponentRow}`}>
                        <span>{group.parentName}</span>
                        {renderVariantsToggle(group)}
                      </div>
                    )}
                    {group.variants.length > 0 && (
                      // Keep editors mounted to preserve drafts and pending saves.
                      <div
                        id={`variants-${group.id}`}
                        className={styles.componentVariants}
                        role="group"
                        aria-label={`Variants of ${group.component?.name || group.parentName}`}
                        hidden={collapsedVariantGroups.has(group.id)}
                      >
                        {group.variants.map((variant) => (
                          <div key={variant.id} className={styles.componentVariant}>
                            {renderRow(variant, { isHidden: collapsedVariantGroups.has(group.id) })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
