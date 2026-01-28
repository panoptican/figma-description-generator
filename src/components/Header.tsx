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
  isGenerating: boolean
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
  isGenerating,
  hasApiKey,
  progress,
  generateCount,
  exportCount,
  searchInputRef
}: HeaderProps) {
  const SparkleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6 7.8 7.8" />
      <path d="M16.2 16.2 18.4 18.4" />
      <path d="M5.6 18.4 7.8 16.2" />
      <path d="M16.2 7.8 18.4 5.6" />
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
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
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--figma-color-border)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      height: '48px',
      boxSizing: 'border-box'
    }}>
      {/* Search input - takes available space */}
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

      {/* Generate All / Cancel button */}
      {isGenerating ? (
        <Button onClick={onCancelClick} danger style={{ flexShrink: 0 }}>
          Cancel ({progress.current}/{progress.total})
        </Button>
      ) : (
        <div title={hasApiKey ? `Generate descriptions for ${generateCount} components (${getShortcutLabel('G', true)})` : 'Add an API key in settings to start'}>
          <Button
            onClick={onGenerateAllClick}
            disabled={!hasApiKey}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            <SparkleIcon /> Generate All ({generateCount})
          </Button>
        </div>
      )}

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

      {/* Settings icon button */}
      <button
        onClick={onSettingsClick}
        aria-label="Open settings"
        style={iconButtonStyle}
      >
        <SettingsIcon />
      </button>
    </div>
  )
}
