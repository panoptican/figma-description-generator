import { ComponentData } from '../types'

interface ComponentGroup {
  id: string
  component?: ComponentData
  parentName?: string
  variants: ComponentData[]
}

export function groupComponentRows(components: ComponentData[]): ComponentGroup[] {
  const groups = new Map<string, ComponentGroup>()

  for (const component of components) {
    const isVariant = component.type === 'VARIANT'
    const groupId = isVariant ? component.parentId || component.id : component.id
    let group = groups.get(groupId)

    if (!group) {
      group = { id: groupId, variants: [] }
      groups.set(groupId, group)
    }

    if (isVariant) {
      group.parentName = component.parentName || 'Component set'
      group.variants.push(component)
    } else {
      group.component = component
    }
  }

  // Keep parent context even when search only matches its variants.
  return Array.from(groups.values())
}
