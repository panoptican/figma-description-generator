import {
  Bold,
  Button,
  Checkbox,
  Muted,
  SearchTextbox,
  Text
} from '@create-figma-plugin/ui'
import { Fragment, h } from 'preact'

import { Scope } from '../types'

interface HeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onSettingsClick: () => void
  onGenerateAllClick: () => void
  onCancelClick: () => void
  isGenerating: boolean
  hasApiKey: boolean
  progress: { current: number; total: number }
  showVariants: boolean
  onShowVariantsChange: (value: boolean) => void
  scope: Scope
  currentPageName: string
}

export function Header({
  searchValue,
  onSearchChange,
  onSettingsClick,
  onGenerateAllClick,
  onCancelClick,
  isGenerating,
  hasApiKey,
  progress,
  showVariants,
  onShowVariantsChange,
  scope,
  currentPageName
}: HeaderProps) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--figma-color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text>
            <Bold>Description Generator</Bold>
          </Text>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--figma-color-bg-secondary)',
              fontSize: '11px',
              color: 'var(--figma-color-text-secondary)'
            }}
          >
            {scope === 'current-page' ? `Page: ${currentPageName}` : 'All pages'}
          </span>
        </div>
        <Button onClick={onSettingsClick} secondary>
          Settings
        </Button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 140px',
        gap: '16px',
        alignItems: 'start'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              border: '1px solid var(--figma-color-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--figma-color-bg)'
            }}
          >
            <SearchTextbox
              placeholder="Search components..."
              value={searchValue}
              onValueInput={onSearchChange}
            />
          </div>
          <Checkbox value={showVariants} onValueChange={onShowVariantsChange}>
            <Text>Show variants</Text>
          </Checkbox>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {isGenerating ? (
            <Fragment>
              <Text style={{ textAlign: 'center', marginBottom: '4px' }}>
                <Bold>{progress.current}/{progress.total}</Bold>
              </Text>
              <Button onClick={onCancelClick} danger fullWidth>
                Cancel
              </Button>
            </Fragment>
          ) : (
            <Fragment>
              <Button
                onClick={onGenerateAllClick}
                disabled={!hasApiKey}
                fullWidth
                style={{ height: '40px', fontSize: '13px' }}
              >
                Generate All
              </Button>
              <Text style={{ fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>
                <Muted>Only fills empty descriptions</Muted>
              </Text>
            </Fragment>
          )}
        </div>
      </div>

      {!hasApiKey && (
        <div style={{ marginTop: '8px' }}>
          <Text style={{ color: 'var(--figma-color-text-danger)' }}>
            Please configure your API key in Settings
          </Text>
        </div>
      )}
    </div>
  )
}
