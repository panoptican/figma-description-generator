import { Bold, Button, Modal, Muted, Text, VerticalSpace } from '@create-figma-plugin/ui'
import { h } from 'preact'
import { useState } from 'preact/hooks'

import { ExportFormat } from '../utils/export'

interface ExportModalProps {
  isOpen: boolean
  exportCount: number
  onClose: () => void
  onExport: (format: ExportFormat) => void
}

export function ExportModal({ isOpen, exportCount, onClose, onExport }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')

  const handleExport = () => {
    onExport(selectedFormat)
    onClose()
  }

  const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )

  return (
    <Modal open={isOpen} onCloseButtonClick={onClose} title="Export Descriptions">
      <div style={{ padding: '16px', width: '360px' }}>
        <Text>
          <Bold>Export Format</Bold>
        </Text>
        <VerticalSpace space="medium" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px',
              border: `2px solid ${selectedFormat === 'csv' ? 'var(--figma-color-border-brand)' : 'var(--figma-color-border)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: selectedFormat === 'csv' ? 'var(--figma-color-bg-brand-tertiary)' : 'var(--figma-color-bg)'
            }}
          >
            <input
              type="radio"
              name="export-format"
              checked={selectedFormat === 'csv'}
              onChange={() => setSelectedFormat('csv')}
              style={{ marginTop: '2px' }}
            />
            <div>
              <Text>
                <Bold>CSV (Spreadsheet)</Bold>
              </Text>
              <VerticalSpace space="extraSmall" />
              <Text>
                <Muted>Compatible with Excel, Google Sheets, and other spreadsheet applications</Muted>
              </Text>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px',
              border: `2px solid ${selectedFormat === 'json' ? 'var(--figma-color-border-brand)' : 'var(--figma-color-border)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: selectedFormat === 'json' ? 'var(--figma-color-bg-brand-tertiary)' : 'var(--figma-color-bg)'
            }}
          >
            <input
              type="radio"
              name="export-format"
              checked={selectedFormat === 'json'}
              onChange={() => setSelectedFormat('json')}
              style={{ marginTop: '2px' }}
            />
            <div>
              <Text>
                <Bold>JSON (Developer-friendly)</Bold>
              </Text>
              <VerticalSpace space="extraSmall" />
              <Text>
                <Muted>Structured data format for programmatic use and documentation tools</Muted>
              </Text>
            </div>
          </label>
        </div>

        <VerticalSpace space="medium" />

        <div
          style={{
            padding: '12px',
            backgroundColor: 'var(--figma-color-bg-secondary)',
            borderRadius: '6px'
          }}
        >
          <Text>
            <Muted>
              {exportCount === 0
                ? 'No components with descriptions to export.'
                : `${exportCount} component${exportCount !== 1 ? 's' : ''} with descriptions will be exported.`}
            </Muted>
          </Text>
        </div>

        <VerticalSpace space="large" />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} secondary>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportCount === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <DownloadIcon /> Export
          </Button>
        </div>
      </div>
    </Modal>
  )
}
