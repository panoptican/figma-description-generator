import { ComponentData } from '../types'
import { isDescriptionEmpty } from './text'

export interface GenerationBatch {
  members: ComponentData[]
}

export function getComponentSetMembers(
  components: ComponentData[],
  componentSet: ComponentData
): ComponentData[] {
  return components.filter((component) => (
    component.id === componentSet.id || component.parentId === componentSet.id
  ))
}

export function getGenerationBatches(
  components: ComponentData[],
  filteredComponents: ComponentData[],
  overwriteExisting: boolean
): GenerationBatch[] {
  const filteredIds = new Set(filteredComponents.map((component) => component.id))
  const targets = components.filter((component) => {
    if (component.type === 'VARIANT') {
      return false
    }

    if (filteredIds.has(component.id)) {
      return true
    }

    return component.type === 'COMPONENT_SET' && components.some((member) => (
      member.parentId === component.id && filteredIds.has(member.id)
    ))
  })

  return targets
    .map((target) => {
      const members = target.type === 'COMPONENT_SET'
        ? getComponentSetMembers(components, target)
        : [target]
      const pendingMembers = overwriteExisting
        ? members
        : members.filter((member) => isDescriptionEmpty(member.currentDescription))

      return { members: pendingMembers }
    })
    .filter((batch) => batch.members.length > 0)
}
