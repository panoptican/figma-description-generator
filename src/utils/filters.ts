import { ComponentData } from '../types'

export interface FilterOptions {
  showVariants: boolean
  searchValue: string
}

/**
 * Filters components based on variant visibility and search criteria.
 * Search matches against component name, page name, and properties.
 */
export function filterComponents(
  components: ComponentData[],
  options: FilterOptions
): ComponentData[] {
  const { showVariants, searchValue } = options

  return components.filter((component) => {
    // Filter out variants if showVariants is false
    if (!showVariants && component.type === 'VARIANT') {
      return false
    }

    // If no search value, include all remaining components
    if (!searchValue) {
      return true
    }

    const searchLower = searchValue.toLowerCase()

    return (
      component.name.toLowerCase().includes(searchLower) ||
      component.pageName.toLowerCase().includes(searchLower) ||
      component.properties.some((p) => p.toLowerCase().includes(searchLower))
    )
  })
}

/**
 * Counts components missing descriptions.
 */
export function countMissingDescriptions(components: ComponentData[]): number {
  return components.filter((c) => !c.currentDescription).length
}

/**
 * Counts components that would be generated based on overwrite setting.
 */
export function countGeneratable(
  components: ComponentData[],
  overwriteExisting: boolean
): number {
  return components.filter((c) => overwriteExisting || !c.currentDescription).length
}

/**
 * Groups components by page name.
 */
export function groupByPage(
  components: ComponentData[]
): Record<string, ComponentData[]> {
  return components.reduce((acc, component) => {
    if (!acc[component.pageName]) {
      acc[component.pageName] = []
    }
    acc[component.pageName].push(component)
    return acc
  }, {} as Record<string, ComponentData[]>)
}
