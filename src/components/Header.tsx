import { Button } from '@create-figma-plugin/ui'
import { h, Ref } from 'preact'

import { getShortcutLabel } from '../hooks/useKeyboardShortcuts'

interface HeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onSettingsClick: () => void
  onGenerateAllClick: () => void
  onCancelClick: () => void
  onExportClick: () => void
  onRefreshClick: () => void
  refreshTitle: string
  scopeLabel: string
  overwriteExisting: boolean
  isGenerating: boolean
  isRefreshing: boolean
  hasApiKey: boolean
  progress: { current: number; total: number }
  generateCount: number
  exportCount: number
  searchInputRef?: Ref<HTMLInputElement>
}

export function Header({
  searchValue,
  onSearchChange,
  onSettingsClick,
  onGenerateAllClick,
  onCancelClick,
  onExportClick,
  onRefreshClick,
  refreshTitle,
  scopeLabel,
  overwriteExisting,
  isGenerating,
  isRefreshing,
  hasApiKey,
  progress,
  generateCount,
  exportCount,
  searchInputRef
}: HeaderProps) {
  const canGenerateAll = hasApiKey && generateCount > 0
  const generateLabel = overwriteExisting
    ? `Replace ${generateCount}`
    : `Fill ${generateCount}`
  const generateTitle = !hasApiKey
    ? 'Add an API key in Settings to start'
    : generateCount === 0
      ? overwriteExisting
        ? 'Nothing to replace'
        : 'Nothing to fill'
      : overwriteExisting
        ? `Overwrites Figma descriptions (${getShortcutLabel('G', true)})`
        : `Writes onto Figma components. Skips existing. (${getShortcutLabel('G', true)})`
  const SparkleIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </svg>
  )

  const SettingsIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.4 1.3 1 1.58.19.09.4.14.61.14H21a2 2 0 0 1 0 4h-.09c-.21 0-.42.05-.61.14-.6.28-1 .89-1 1.58Z" />
    </svg>
  )

  const ExportIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )

  const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )

  const iconButtonStyle = {
    width: 32,
    height: 32,
    borderRadius: '6px',
    border: '1px solid var(--figma-color-border)',
    backgroundColor: 'var(--figma-color-bg)',
    color: 'var(--figma-color-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0
  }

  return (
    <div>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--figma-color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '48px',
        boxSizing: 'border-box'
      }}>
      <span
        title={scopeLabel}
        style={{
          fontSize: '11px',
          color: 'var(--figma-color-text-secondary)',
          flexShrink: 0,
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {scopeLabel}
      </span>
      <div
        style={{
          flex: 1,
          border: '1px solid var(--figma-color-border)',
          borderRadius: '6px',
          backgroundColor: 'var(--figma-color-bg)',
          position: 'relative',
          minWidth: 0
        }}
      >
        <input
          ref={searchInputRef}
          type="text"
          placeholder={`Search components... (${getShortcutLabel('F')})`}
          value={searchValue}
          onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
          style={{
            width: '100%',
            height: '32px',
            padding: '0 12px 0 32px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: 'var(--figma-color-text)',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--figma-color-text-secondary)"
          stroke-width="2"
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {isGenerating ? (
        <Button
          onClick={onCancelClick}
          danger
          title="Already-written descriptions stay."
          style={{ flexShrink: 0 }}
        >
          Stop remaining ({progress.current}/{progress.total})
        </Button>
      ) : (
        <button
          onClick={onGenerateAllClick}
          disabled={!canGenerateAll}
          title={generateTitle}
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'var(--figma-color-bg-brand)',
            color: 'var(--figma-color-text-onbrand)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: canGenerateAll ? 'pointer' : 'not-allowed',
            opacity: canGenerateAll ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <SparkleIcon /> {generateLabel}
        </button>
      )}

      {/* Refresh component scan */}
      <button
        onClick={onRefreshClick}
        disabled={isRefreshing || isGenerating}
        aria-label={refreshTitle}
        title={isRefreshing ? 'Refreshing components...' : refreshTitle}
        style={{
          ...iconButtonStyle,
          color: isRefreshing || isGenerating
            ? 'var(--figma-color-text-disabled)'
            : 'var(--figma-color-text)',
          cursor: isRefreshing || isGenerating ? 'not-allowed' : 'pointer',
          opacity: isRefreshing || isGenerating ? 0.5 : 1
        }}
      >
        <RefreshIcon />
      </button>

      {/* Export icon button */}
      <button
        onClick={onExportClick}
        disabled={exportCount === 0}
        aria-label="Export descriptions"
        title={exportCount > 0 ? `Export ${exportCount} descriptions` : 'No descriptions to export'}
        style={{
          ...iconButtonStyle,
          color: exportCount > 0 ? 'var(--figma-color-text)' : 'var(--figma-color-text-disabled)',
          cursor: exportCount > 0 ? 'pointer' : 'not-allowed',
          opacity: exportCount > 0 ? 1 : 0.5
        }}
      >
        <ExportIcon />
      </button>

      <button
        onClick={onSettingsClick}
        aria-label="Settings"
        title="Settings"
        style={iconButtonStyle}
      >
        <SettingsIcon />
      </button>
    </div>
    {!hasApiKey && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--figma-color-border)',
          backgroundColor: 'var(--figma-color-bg-secondary)',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--figma-color-text)' }}>
          Add an API key in Settings before you can generate.
        </span>
        <Button onClick={onSettingsClick} secondary>
          Open Settings
        </Button>
      </div>
    )}
    </div>
  )
}
