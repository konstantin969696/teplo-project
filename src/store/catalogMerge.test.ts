import { describe, it, expect } from 'vitest'
import { mergeSeedWithOverrides } from './catalogMerge'
import type { CatalogItem } from './catalogMerge'

interface TestItem extends CatalogItem {
  readonly id: string
  readonly name: string
  readonly isCustom: boolean
}

const seedItem1: TestItem = { id: 'item-1', name: 'Item One', isCustom: false }
const seedItem2: TestItem = { id: 'item-2', name: 'Item Two', isCustom: false }
const seedItem3: TestItem = { id: 'item-3', name: 'Item Three', isCustom: false }

const seedById: Record<string, TestItem> = {
  'item-1': seedItem1,
  'item-2': seedItem2,
  'item-3': seedItem3,
}

describe('mergeSeedWithOverrides', () => {
  it('Test 1: no overrides, no deletions — returns seed unchanged', () => {
    const result = mergeSeedWithOverrides(seedById, {}, [])
    expect(Object.keys(result)).toHaveLength(3)
    expect(result['item-1']).toEqual(seedItem1)
    expect(result['item-2']).toEqual(seedItem2)
    expect(result['item-3']).toEqual(seedItem3)
  })

  it('Test 2: deleted seed id is removed from result', () => {
    const result = mergeSeedWithOverrides(seedById, {}, ['item-1'])
    expect(result['item-1']).toBeUndefined()
    expect(result['item-2']).toBeDefined()
    expect(result['item-3']).toBeDefined()
    expect(Object.keys(result)).toHaveLength(2)
  })

  it('Test 2b: multiple deletions', () => {
    const result = mergeSeedWithOverrides(seedById, {}, ['item-1', 'item-3'])
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['item-2']).toBeDefined()
  })

  it('Test 3: override replaces seed entry', () => {
    const modified: TestItem = { id: 'item-1', name: 'Modified', isCustom: true }
    const result = mergeSeedWithOverrides(seedById, { 'item-1': modified }, [])
    expect(result['item-1']).toEqual(modified)
    expect(result['item-1'].name).toBe('Modified')
    expect(result['item-1'].isCustom).toBe(true)
  })

  it('Test 3b: override adds new custom item not in seed', () => {
    const customItem: TestItem = { id: 'custom-99', name: 'Custom', isCustom: true }
    const result = mergeSeedWithOverrides(seedById, { 'custom-99': customItem }, [])
    expect(Object.keys(result)).toHaveLength(4)
    expect(result['custom-99']).toEqual(customItem)
  })

  it('Test 4: delete then override — override wins (override re-adds deleted item)', () => {
    const reAdded: TestItem = { id: 'item-1', name: 'Re-added', isCustom: true }
    const result = mergeSeedWithOverrides(seedById, { 'item-1': reAdded }, ['item-1'])
    // override applied after deletion — item is back
    expect(result['item-1']).toEqual(reAdded)
  })

  it('Test 5: does not mutate seedById input', () => {
    const original = { ...seedById }
    mergeSeedWithOverrides(seedById, {}, ['item-1', 'item-2'])
    expect(Object.keys(seedById)).toHaveLength(Object.keys(original).length)
    expect(seedById['item-1']).toBeDefined()
  })
})
