import { ComponentData } from '../types'
import { isDescriptionEmpty } from './text'

export interface GenerationBatch {
  members: ComponentData[]
}

export function getComponentSetMembers(
  components: ComponentData[],
  componentSet: ComponentData,
  includeVariants = true
): ComponentData[] {
  return components.filter((component) => (
    component.id === componentSet.id || (includeVariants && component.parentId === componentSet.id)
  ))
}

export function getGenerationBatches(
  components: ComponentData[],
  filteredComponents: ComponentData[],
  overwriteExisting: boolean,
  includeVariants = true,
  pageId?: string
): GenerationBatch[] {
  const scopedComponents = pageId === undefined
    ? components
    : components.filter((component) => component.pageId === pageId)
  const filteredIds = new Set(filteredComponents.map((component) => component.id))
  const targets = scopedComponents.filter((component) => {
    if (component.type === 'VARIANT') {
      return false
    }

    if (filteredIds.has(component.id)) {
      return true
    }

    return includeVariants && component.type === 'COMPONENT_SET' && scopedComponents.some((member) => (
      member.parentId === component.id && filteredIds.has(member.id)
    ))
  })

  return targets
    .map((target) => {
      const members = target.type === 'COMPONENT_SET'
        ? getComponentSetMembers(scopedComponents, target, includeVariants)
        : [target]
      const pendingMembers = overwriteExisting
        ? members
        : members.filter((member) => isDescriptionEmpty(member.currentDescription))

      return { members: pendingMembers }
    })
    .filter((batch) => batch.members.length > 0)
}
