import { describe, expect, it } from 'vitest'

import { ComponentData } from '../types'
import { getComponentSetMembers, getGenerationBatches } from './generationBatches'

const createComponent = (overrides: Partial<ComponentData> = {}): ComponentData => ({
  id: 'test-id',
  name: 'TestComponent',
  type: 'COMPONENT',
  properties: [],
  currentDescription: '',
  pageName: 'Page 1',
  ...overrides
})

describe('getComponentSetMembers', () => {
  it('includes the set and its variants', () => {
    const set = createComponent({ id: 'set', type: 'COMPONENT_SET' })
    const variant = createComponent({ id: 'v1', type: 'VARIANT', parentId: 'set' })
    const other = createComponent({ id: 'other', type: 'COMPONENT' })

    expect(getComponentSetMembers([set, variant, other], set).map((c) => c.id)).toEqual(['set', 'v1'])
  })
})

describe('getGenerationBatches', () => {
  const standalone = createComponent({ id: 'button', name: 'Button' })
  const described = createComponent({ id: 'card', name: 'Card', currentDescription: 'Has text' })
  const whitespace = createComponent({ id: 'spacer', name: 'Spacer', currentDescription: '   ' })
  const set = createComponent({ id: 'set', name: 'IconButton', type: 'COMPONENT_SET' })
  const variantMissing = createComponent({
    id: 'v1',
    name: 'size=small',
    type: 'VARIANT',
    parentId: 'set'
  })
  const variantDescribed = createComponent({
    id: 'v2',
    name: 'size=large',
    type: 'VARIANT',
    parentId: 'set',
    currentDescription: 'Large variant'
  })

  const inventory = [standalone, described, whitespace, set, variantMissing, variantDescribed]

  it('skips members with real descriptions when overwrite is off', () => {
    const batches = getGenerationBatches(inventory, inventory, false)
    const memberIds = batches.flatMap((batch) => batch.members.map((member) => member.id))

    expect(memberIds).toEqual(['button', 'spacer', 'set', 'v1'])
    expect(memberIds).not.toContain('card')
    expect(memberIds).not.toContain('v2')
  })

  it('treats whitespace-only descriptions as missing when overwrite is off', () => {
    const batches = getGenerationBatches(inventory, [whitespace], false)

    expect(batches).toHaveLength(1)
    expect(batches[0].members.map((member) => member.id)).toEqual(['spacer'])
  })

  it('includes described members when overwrite is on', () => {
    const batches = getGenerationBatches(inventory, inventory, true)
    const memberIds = batches.flatMap((batch) => batch.members.map((member) => member.id))

    expect(memberIds).toEqual(['button', 'card', 'spacer', 'set', 'v1', 'v2'])
  })

  it('does not treat variants as top-level targets', () => {
    const batches = getGenerationBatches(inventory, [variantMissing], false)
    const memberIds = batches.flatMap((batch) => batch.members.map((member) => member.id))

    expect(memberIds).toEqual(['set', 'v1'])
  })
})
