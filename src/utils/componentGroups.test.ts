import { describe, expect, it } from 'vitest'

import { ComponentData } from '../types'
import { groupComponentRows } from './componentGroups'

function component(id: string, overrides: Partial<ComponentData> = {}): ComponentData {
  return {
    id,
    name: id,
    type: 'COMPONENT',
    properties: [],
    currentDescription: '',
    pageId: 'menu-page',
    pageName: 'Menu',
    ...overrides,
  }
}

function variant(id: string, parentId = 'set'): ComponentData {
  return component(id, { type: 'VARIANT', parentId, parentName: 'Menu Item' })
}

describe('groupComponentRows', () => {
  it('keeps standalone components separate and nests variants under their set', () => {
    const standalone = component('Menu Header')
    const parent = component('set', { type: 'COMPONENT_SET' })
    const children = [variant('Default'), variant('Hover')]
    const trailing = component('Menu Footer')

    const groups = groupComponentRows([standalone, parent, ...children, trailing])

    expect(groups.map((group) => group.component)).toEqual([standalone, parent, trailing])
    expect(groups[0].variants).toEqual([])
    expect(groups[1].variants).toEqual(children)
    expect(groups[2].variants).toEqual([])
  })

  it('keeps a parent container when search only matches variants', () => {
    const child = variant('Hover')
    expect(groupComponentRows([child])).toEqual([
      { id: 'set', parentName: 'Menu Item', variants: [child] },
    ])
  })

  it('uses parent IDs to keep identically named sets separate', () => {
    const groups = groupComponentRows([variant('Default', 'set-a'), variant('Hover', 'set-b')])
    expect(groups.map((group) => group.id)).toEqual(['set-a', 'set-b'])
    expect(groups.map((group) => group.variants.length)).toEqual([1, 1])
  })

  it('finds the parent even when a variant appears earlier in the scan', () => {
    const child = variant('Default')
    const parent = component('set', { type: 'COMPONENT_SET' })
    const groups = groupComponentRows([child, component('other'), parent])
    expect(groups).toHaveLength(2)
    expect(groups[0].component).toBe(parent)
    expect(groups[0].variants).toEqual([child])
  })

  it('does not attach variants with missing parent IDs to unrelated components', () => {
    const orphan = component('orphan', { type: 'VARIANT' })
    const groups = groupComponentRows([component('other'), orphan])
    expect(groups).toHaveLength(2)
    expect(groups[1]).toEqual({ id: 'orphan', parentName: 'Component set', variants: [orphan] })
  })

  it('does not add variants when none are visible', () => {
    const parent = component('set', { type: 'COMPONENT_SET' })
    expect(groupComponentRows([parent])).toEqual([{ id: 'set', component: parent, variants: [] }])
    expect(groupComponentRows([])).toEqual([])
  })
})
