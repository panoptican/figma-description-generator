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
  includeVariants = true
): GenerationBatch[] {
  const filteredIds = new Set(filteredComponents.map((component) => component.id))
  const targets = components.filter((component) => {
    if (component.type === 'VARIANT') {
      return false
    }

    if (filteredIds.has(component.id)) {
      return true
    }

    return includeVariants && component.type === 'COMPONENT_SET' && components.some((member) => (
      member.parentId === component.id && filteredIds.has(member.id)
    ))
  })

  return targets
    .map((target) => {
      const members = target.type === 'COMPONENT_SET'
        ? getComponentSetMembers(components, target, includeVariants)
        : [target]
      const pendingMembers = overwriteExisting
        ? members
        : members.filter((member) => isDescriptionEmpty(member.currentDescription))

      return { members: pendingMembers }
    })
    .filter((batch) => batch.members.length > 0)
}
