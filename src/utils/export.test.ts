import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  prepareExportData,
  escapeCSVValue,
  toCSV,
  toJSON,
  createDataURL,
  generateFilename,
  exportDescriptions,
  ExportData
} from './export'
import { ComponentData } from '../types'

const mockComponents: ComponentData[] = [
  {
    id: '1:1',
    name: 'Button',
    type: 'COMPONENT',
    properties: [],
    currentDescription: 'A clickable button component',
    pageName: 'Components'
  },
  {
    id: '1:2',
    name: 'IconButton',
    type: 'COMPONENT_SET',
    properties: ['size: small, medium, large', 'variant: primary, secondary'],
    currentDescription: 'An icon button with multiple variants',
    pageName: 'Components'
  },
  {
    id: '1:3',
    name: 'size=small, variant=primary',
    type: 'VARIANT',
    properties: ['size=small', 'variant=primary'],
    currentDescription: 'Small primary icon button variant',
    pageName: 'Components',
    parentName: 'IconButton'
  },
  {
    id: '1:4',
    name: 'Card',
    type: 'COMPONENT',
    properties: [],
    currentDescription: '', // Empty description - should be filtered
    pageName: 'Components'
  },
  {
    id: '1:5',
    name: 'Modal',
    type: 'COMPONENT',
    properties: [],
    currentDescription: '   ', // Whitespace only - should be filtered
    pageName: 'Pages'
  }
]

describe('prepareExportData', () => {
  it('filters out components without descriptions', () => {
    const result = prepareExportData(mockComponents)
    expect(result).toHaveLength(3)
    expect(result.every((r) => r.description.trim().length > 0)).toBe(true)
  })

  it('transforms component data to export format', () => {
    const result = prepareExportData(mockComponents)
    const button = result.find((r) => r.componentName === 'Button')

    expect(button).toEqual({
      componentId: '1:1',
      componentName: 'Button',
      pageName: 'Components',
      type: 'COMPONENT',
      properties: [],
      description: 'A clickable button component'
    })
  })

  it('preserves properties array', () => {
    const result = prepareExportData(mockComponents)
    const iconButton = result.find((r) => r.componentName === 'IconButton')

    expect(iconButton?.properties).toEqual([
      'size: small, medium, large',
      'variant: primary, secondary'
    ])
  })

  it('returns empty array for empty input', () => {
    expect(prepareExportData([])).toEqual([])
  })

  it('returns empty array when all components lack descriptions', () => {
    const noDescriptions: ComponentData[] = [
      {
        id: '1:1',
        name: 'Empty',
        type: 'COMPONENT',
        properties: [],
        currentDescription: '',
        pageName: 'Test'
      }
    ]
    expect(prepareExportData(noDescriptions)).toEqual([])
  })
})

describe('escapeCSVValue', () => {
  it('returns simple values unchanged', () => {
    expect(escapeCSVValue('Hello')).toBe('Hello')
  })

  it('wraps values containing commas in quotes', () => {
    expect(escapeCSVValue('Hello, World')).toBe('"Hello, World"')
  })

  it('wraps values containing quotes and escapes them', () => {
    expect(escapeCSVValue('Say "Hello"')).toBe('"Say ""Hello"""')
  })

  it('wraps values containing newlines', () => {
    expect(escapeCSVValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"')
  })

  it('wraps values containing carriage returns', () => {
    expect(escapeCSVValue('Line 1\rLine 2')).toBe('"Line 1\rLine 2"')
  })

  it('handles values with multiple special characters', () => {
    expect(escapeCSVValue('Hello, "World"\nHow are you?')).toBe(
      '"Hello, ""World""\nHow are you?"'
    )
  })

  it('handles empty string', () => {
    expect(escapeCSVValue('')).toBe('')
  })
})

describe('toCSV', () => {
  it('produces valid CSV with headers', () => {
    const data: ExportData[] = [
      {
        componentId: '1:1',
        componentName: 'Button',
        pageName: 'Components',
        type: 'COMPONENT',
        properties: [],
        description: 'A button'
      }
    ]

    const csv = toCSV(data)
    const lines = csv.split('\n')

    expect(lines[0]).toBe('Component ID,Component Name,Page Name,Type,Properties,Description')
    expect(lines[1]).toBe('1:1,Button,Components,COMPONENT,,A button')
  })

  it('joins properties with semicolon', () => {
    const data: ExportData[] = [
      {
        componentId: '1:1',
        componentName: 'Button',
        pageName: 'Components',
        type: 'COMPONENT_SET',
        properties: ['size: sm, md', 'variant: primary'],
        description: 'A button'
      }
    ]

    const csv = toCSV(data)
    const lines = csv.split('\n')

    // Properties with semicolon separator
    expect(lines[1]).toContain('size: sm, md; variant: primary')
  })

  it('escapes special characters in descriptions', () => {
    const data: ExportData[] = [
      {
        componentId: '1:1',
        componentName: 'Button',
        pageName: 'Components',
        type: 'COMPONENT',
        properties: [],
        description: 'A button with "quotes" and, commas'
      }
    ]

    const csv = toCSV(data)

    expect(csv).toContain('"A button with ""quotes"" and, commas"')
  })

  it('handles empty data array', () => {
    const csv = toCSV([])
    expect(csv).toBe('Component ID,Component Name,Page Name,Type,Properties,Description')
  })

  it('handles multiple rows', () => {
    const data: ExportData[] = [
      {
        componentId: '1:1',
        componentName: 'Button',
        pageName: 'Page1',
        type: 'COMPONENT',
        properties: [],
        description: 'Button desc'
      },
      {
        componentId: '1:2',
        componentName: 'Card',
        pageName: 'Page2',
        type: 'COMPONENT',
        properties: [],
        description: 'Card desc'
      }
    ]

    const csv = toCSV(data)
    const lines = csv.split('\n')

    expect(lines).toHaveLength(3) // header + 2 rows
    expect(lines[1]).toContain('Button')
    expect(lines[2]).toContain('Card')
  })
})

describe('toJSON', () => {
  it('produces pretty-printed JSON', () => {
    const data: ExportData[] = [
      {
        componentId: '1:1',
        componentName: 'Button',
        pageName: 'Components',
        type: 'COMPONENT',
        properties: [],
        description: 'A button'
      }
    ]

    const json = toJSON(data)
    const parsed = JSON.parse(json)

    expect(parsed).toEqual(data)
    // Check it's indented (pretty-printed)
    expect(json).toContain('\n')
    expect(json).toContain('  ')
  })

  it('handles empty array', () => {
    expect(toJSON([])).toBe('[]')
  })

  it('preserves special characters in descriptions', () => {
    const data: ExportData[] = [
      {
        componentId: '1:1',
        componentName: 'Button',
        pageName: 'Components',
        type: 'COMPONENT',
        properties: [],
        description: 'A button with "quotes" and\nnewlines'
      }
    ]

    const json = toJSON(data)
    const parsed = JSON.parse(json)

    expect(parsed[0].description).toBe('A button with "quotes" and\nnewlines')
  })
})

describe('createDataURL', () => {
  it('creates valid data URL for text content', () => {
    const url = createDataURL('Hello', 'text/plain')
    expect(url).toBe('data:text/plain;charset=utf-8,Hello')
  })

  it('encodes special characters', () => {
    const url = createDataURL('Hello World', 'text/plain')
    expect(url).toBe('data:text/plain;charset=utf-8,Hello%20World')
  })

  it('creates data URL for CSV', () => {
    const url = createDataURL('a,b,c', 'text/csv')
    expect(url).toContain('data:text/csv;charset=utf-8,')
  })

  it('creates data URL for JSON', () => {
    const url = createDataURL('{"a":1}', 'application/json')
    expect(url).toContain('data:application/json;charset=utf-8,')
  })
})

describe('generateFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates CSV filename with date', () => {
    const filename = generateFilename('csv')
    expect(filename).toBe('component-descriptions-2025-01-27.csv')
  })

  it('generates JSON filename with date', () => {
    const filename = generateFilename('json')
    expect(filename).toBe('component-descriptions-2025-01-27.json')
  })
})

describe('exportDescriptions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exports to CSV format', () => {
    const { dataURL, filename } = exportDescriptions(mockComponents, 'csv')

    expect(filename).toBe('component-descriptions-2025-01-27.csv')
    expect(dataURL).toContain('data:text/csv;charset=utf-8,')
    expect(dataURL).toContain('Component%20ID')
  })

  it('exports to JSON format', () => {
    const { dataURL, filename } = exportDescriptions(mockComponents, 'json')

    expect(filename).toBe('component-descriptions-2025-01-27.json')
    expect(dataURL).toContain('data:application/json;charset=utf-8,')
  })

  it('only includes components with descriptions', () => {
    const { dataURL } = exportDescriptions(mockComponents, 'json')
    const content = decodeURIComponent(dataURL.split(',')[1])
    const parsed = JSON.parse(content)

    // mockComponents has 5 items, but only 3 have descriptions
    expect(parsed).toHaveLength(3)
  })
})
