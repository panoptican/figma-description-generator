import { describe, expect, it } from 'vitest'

import { ComponentData } from '../types'
import { getComponentSetMembers, getGenerationBatches } from './generationBatches'

const createComponent = (overrides: Partial<ComponentData> = {}): ComponentData => ({
  id: 'test-id',
  name: 'TestComponent',
  type: 'COMPONENT',
  properties: [],
  currentDescription: '',
  pageId: 'page-1',
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
  it.each([false, true])('excludes hidden variants from Fill and Replace batches (overwrite=%s)', (overwrite) => {
    const visible = inventory.filter(component => component.type !== 'VARIANT')
    const ids = getGenerationBatches(inventory, visible, overwrite, false)
      .flatMap(batch => batch.members.map(member => member.id))
    expect(ids).toEqual(overwrite ? ['button', 'card', 'spacer', 'set'] : ['button', 'spacer', 'set'])
  })

  it('does not fill hidden variants when their set already has a description', () => {
    const describedSet = { ...set, currentDescription: 'Set description' }
    expect(getGenerationBatches([describedSet, variantMissing], [describedSet], false, false)).toEqual([])
  })

  it('restricts set generation to the set when variants are hidden', () => {
    expect(getComponentSetMembers(inventory, set, false).map(member => member.id)).toEqual(['set'])
  })

  const otherPage = inventory.map(component => ({
    ...component,
    id: `other-${component.id}`,
    parentId: component.parentId ? `other-${component.parentId}` : undefined,
    pageId: 'page-2',
    pageName: 'Page 2',
  }))
  const wholeFile = [...inventory, ...otherPage]

  it.each([false, true])('limits page generation to the chosen page (overwrite=%s)', (overwrite) => {
    const batches = getGenerationBatches(wholeFile, wholeFile, overwrite, true, 'page-2')
    const members = batches.flatMap(batch => batch.members)
    expect(members.map(member => member.id)).toEqual(overwrite
      ? ['other-button', 'other-card', 'other-spacer', 'other-set', 'other-v1', 'other-v2']
      : ['other-button', 'other-spacer', 'other-set', 'other-v1'])
    expect(members.every(member => member.pageName === 'Page 2')).toBe(true)
  })

  it('keeps page generation limited to search targets while grouping variant siblings', () => {
    const visible = [variantMissing, otherPage.find(component => component.id === 'other-v1')!]
    const batches = getGenerationBatches(wholeFile, visible, true, true, 'page-2')
    expect(batches.map(batch => batch.members.map(member => member.id))).toEqual([
      ['other-set', 'other-v1', 'other-v2'],
    ])
  })

  it('excludes hidden variants from a page run', () => {
    const batches = getGenerationBatches(wholeFile, wholeFile, true, false, 'page-2')
    expect(batches.flatMap(batch => batch.members.map(member => member.id))).toEqual([
      'other-button', 'other-card', 'other-spacer', 'other-set',
    ])
  })

  it('returns no work when the page has no matching targets', () => {
    expect(getGenerationBatches(wholeFile, inventory, false, true, 'page-2')).toEqual([])
    expect(getGenerationBatches(wholeFile, wholeFile, true, true, 'Unknown page')).toEqual([])
  })

  it('keeps same-named pages separate during page generation', () => {
    const sameNamedPage = otherPage.map(component => ({ ...component, pageName: 'Page 1' }))
    const file = [...inventory, ...sameNamedPage]
    const members = getGenerationBatches(file, file, true, true, 'page-2')
      .flatMap(batch => batch.members)
    expect(members.map(member => member.id)).toEqual(sameNamedPage.map(member => member.id))
  })

  it('keeps the page button count consistent with the whole-file batch inventory', () => {
    const expectedCount = getGenerationBatches(wholeFile, wholeFile, false).flatMap(batch => batch.members)
      .filter(member => member.pageId === 'page-2').length
    const pageCount = getGenerationBatches(wholeFile, wholeFile, false, true, 'page-2')
      .reduce((count, batch) => count + batch.members.length, 0)
    expect(pageCount).toBe(expectedCount)
    expect(pageCount).toBe(4)
  })

})
