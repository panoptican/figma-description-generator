import {
  Bold,
  Button,
  SearchTextbox,
  Text
} from '@create-figma-plugin/ui'
import { h } from 'preact'

interface HeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onSettingsClick: () => void
  onGenerateAllClick: () => void
  onCancelClick: () => void
  isGenerating: boolean
  hasApiKey: boolean
  progress: { current: number; total: number }
}

export function Header({
  searchValue,
  onSearchChange,
  onSettingsClick,
  onGenerateAllClick,
  onCancelClick,
  isGenerating,
  hasApiKey,
  progress
}: HeaderProps) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--figma-color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Text>
          <Bold>Description Generator</Bold>
        </Text>
        <Button onClick={onSettingsClick} secondary>
          Settings
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
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
        {isGenerating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Text>
              <Bold>{progress.current}/{progress.total}</Bold>
            </Text>
            <Button onClick={onCancelClick} danger>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={onGenerateAllClick}
            disabled={!hasApiKey}
          >
            Generate All
          </Button>
        )}
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
