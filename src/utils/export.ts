import { ComponentData } from '../types'
import { isDescriptionEmpty } from './text'

export type ExportFormat = 'csv' | 'json'

export interface ExportData {
  componentId: string
  componentName: string
  pageName: string
  type: 'COMPONENT' | 'COMPONENT_SET' | 'VARIANT'
  properties: string[]
  description: string
}

/**
 * Transforms ComponentData array into exportable format.
 * Only includes components that have descriptions.
 */
export function prepareExportData(components: ComponentData[]): ExportData[] {
  return components
    .filter((c) => !isDescriptionEmpty(c.currentDescription))
    .map((c) => ({
      componentId: c.id,
      componentName: c.name,
      pageName: c.pageName,
      type: c.type,
      properties: c.properties,
      description: c.currentDescription
    }))
}

/**
 * Escapes a value for CSV format.
 * Handles commas, quotes, and newlines.
 */
export function escapeCSVValue(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // Escape double quotes by doubling them
    const escaped = value.replace(/"/g, '""')
    return `"${escaped}"`
  }
  return value
}

/**
 * Converts export data to CSV format.
 */
export function toCSV(data: ExportData[]): string {
  // CSV header
  const headers = ['Component ID', 'Component Name', 'Page Name', 'Type', 'Properties', 'Description']
  const headerRow = headers.map(escapeCSVValue).join(',')

  // CSV rows
  const rows = data.map((item) => {
    const values = [
      item.componentId,
      item.componentName,
      item.pageName,
      item.type,
      item.properties.join('; '),
      item.description
    ]
    return values.map(escapeCSVValue).join(',')
  })

  return [headerRow, ...rows].join('\n')
}

/**
 * Converts export data to pretty-printed JSON format.
 */
export function toJSON(data: ExportData[]): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Creates a data URL for file download.
 */
export function createDataURL(content: string, mimeType: string): string {
  const encoded = encodeURIComponent(content)
  return `data:${mimeType};charset=utf-8,${encoded}`
}

/**
 * Generates a filename for the export based on format and timestamp.
 */
export function generateFilename(format: ExportFormat): string {
  const timestamp = new Date().toISOString().slice(0, 10)
  const extension = format === 'csv' ? 'csv' : 'json'
  return `component-descriptions-${timestamp}.${extension}`
}

/**
 * Performs the export operation.
 * Returns the data URL and filename for download.
 */
export function exportDescriptions(
  components: ComponentData[],
  format: ExportFormat
): { dataURL: string; filename: string } {
  const exportData = prepareExportData(components)

  let content: string
  let mimeType: string

  if (format === 'csv') {
    content = toCSV(exportData)
    mimeType = 'text/csv'
  } else {
    content = toJSON(exportData)
    mimeType = 'application/json'
  }

  const dataURL = createDataURL(content, mimeType)
  const filename = generateFilename(format)

  return { dataURL, filename }
}
