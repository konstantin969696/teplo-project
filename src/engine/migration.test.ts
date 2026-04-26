/**
 * RED scaffold: migration v1.0 → v1.1.
 * Tests WILL FAIL until migration.ts is implemented in Plan 02.
 *
 * Covers:
 *   - runV11Migration: seed, migrate, idempotency, hasOldFields-no-members
 *   - migrateV10toV11Json: JSON shape, __proto__ guard, round-trip, partial v1.0 fields (W6)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { runV11Migration, migrateV10toV11Json, DEFAULT_SYSTEM } from '../engine/migration'
import type { HeatingSystem } from '../types/system'
import { V10_PROJECT_STATE, V10_SEGMENTS, V10_SEGMENT_ORDER, V10_EQUIPMENT, V10_UFH_LOOPS } from './__fixtures__/v10'
import { V11_EXPECTED_SYSTEM_NAME, V11_EXPECTED_SYSTEM_FIELDS, V11_EXPECTED_PROJECT_FIELDS_REMOVED } from './__fixtures__/v11-expected'

// Mock stores API for runV11Migration
function makeEmptyStores() {
  const systems: Record<string, HeatingSystem> = {}
  const systemOrder: string[] = []
  const segments: Record<string, unknown> = {}
  const segmentOrder: string[] = []
  const equipment: Record<string, unknown> = {}
  const equipmentOrder: string[] = []
  const ufhLoops: Record<string, unknown> = {}
  // projectFields is returned by-reference so Object.assign(getState(), {...}) persists
  const projectFields: Record<string, unknown> = {
    schemaVersion: undefined,
    setSchemaVersion: (v: string) => { projectFields.schemaVersion = v }
  }

  return {
    projectStore: {
      getState: () => projectFields
    },
    systemStore: {
      getState: () => ({
        systems,
        systemOrder,
        addSystem: (sys: Omit<HeatingSystem, 'id'>) => {
          const id = `sys-${Math.random().toString(36).slice(2)}`
          systems[id] = { ...sys, id }
          systemOrder.push(id)
          return id
        }
      })
    },
    segmentStore: {
      getState: () => ({
        segments,
        segmentOrder,
        bulkSetSystemId: (ids: string[], sysId: string) => {
          for (const id of ids) {
            if (segments[id]) (segments[id] as Record<string, unknown>).systemId = sysId
          }
        }
      })
    },
    equipmentStore: {
      getState: () => ({
        equipment,
        equipmentOrder,
        bulkSetSystemId: (ids: string[], sysId: string) => {
          for (const id of ids) {
            if (equipment[id]) (equipment[id] as Record<string, unknown>).systemId = sysId
          }
        }
      })
    },
    ufhLoopStore: {
      getState: () => ({
        // Phase 04.3: mock matches the real ufhLoopStore API — `loops` keyed
        // by id (no order-array), bulkSetSystemId is single-arg.
        loops: ufhLoops,
        loopsByRoom: {} as Record<string, string>,
        bulkSetSystemId: (sysId: string) => {
          for (const id of Object.keys(ufhLoops)) {
            (ufhLoops[id] as Record<string, unknown>).systemId = sysId
          }
        }
      })
    }
  }
}

function makeV10Stores() {
  const stores = makeEmptyStores()
  // Populate v1.0 data: segments and equipment without systemId
  Object.assign(stores.segmentStore.getState().segments, V10_SEGMENTS)
  stores.segmentStore.getState().segmentOrder.push(...V10_SEGMENT_ORDER)
  Object.assign(stores.equipmentStore.getState().equipment, V10_EQUIPMENT)
  stores.equipmentStore.getState().equipmentOrder.push('eq-1')
  // Phase 04.3: real ufhLoopStore has no order-array — id присутствует
  // в ключах ufhLoops (V10_UFH_LOOPS), миграция итерирует через Object.keys.
  Object.assign(stores.ufhLoopStore.getState().loops, V10_UFH_LOOPS)

  // Set v1.0 project fields
  const projectState = stores.projectStore.getState()
  Object.assign(projectState, V10_PROJECT_STATE)

  return stores
}

describe('runV11Migration', () => {
  it('seeds default "Система 1" when all stores empty', () => {
    const stores = makeEmptyStores()
    const result = runV11Migration(stores as Parameters<typeof runV11Migration>[0])
    expect(result.migrated).toBe(false)
    expect(result.seeded).toBe(true)
    expect(result.systemId).not.toBeNull()
    const state = stores.systemStore.getState()
    const sys = state.systems[result.systemId!]
    expect(sys).toBeDefined()
    expect(sys.name).toBe('Система 1')
    expect(sys.tSupply).toBe(80) // DEFAULT_SYSTEM default
  })

  it('migrates v1.0 stores with members', () => {
    const stores = makeV10Stores()
    const result = runV11Migration(stores as Parameters<typeof runV11Migration>[0])
    expect(result.migrated).toBe(true)
    expect(result.seeded).toBe(false)
    expect(result.systemId).not.toBeNull()
    // System should have tSupply from v1.0 project
    const sys = stores.systemStore.getState().systems[result.systemId!]
    expect(sys.tSupply).toBe(V10_PROJECT_STATE.tSupply)
    expect(sys.tReturn).toBe(V10_PROJECT_STATE.tReturn)
    // All segments/equipment/ufhLoops should have systemId set
    for (const segId of V10_SEGMENT_ORDER) {
      expect((stores.segmentStore.getState().segments[segId] as Record<string, unknown>).systemId).toBe(result.systemId)
    }
    expect((stores.equipmentStore.getState().equipment['eq-1'] as Record<string, unknown>).systemId).toBe(result.systemId)
    expect((stores.ufhLoopStore.getState().loops['loop-1'] as Record<string, unknown>).systemId).toBe(result.systemId)
  })

  it('is idempotent — second call returns { migrated: false, seeded: false, systemId: null }', () => {
    const stores = makeV10Stores()
    runV11Migration(stores as Parameters<typeof runV11Migration>[0])
    const result2 = runV11Migration(stores as Parameters<typeof runV11Migration>[0])
    expect(result2.migrated).toBe(false)
    expect(result2.seeded).toBe(false)
    expect(result2.systemId).toBeNull()
    // Should NOT have created a second system
    expect(stores.systemStore.getState().systemOrder.length).toBe(1)
  })

  it('handles hasOldFields but no members — still migrates (creates system with old values)', () => {
    const stores = makeEmptyStores()
    // Set v1.0 project fields but no segments/equipment/ufhLoops
    Object.assign(stores.projectStore.getState(), {
      tSupply: 75, tReturn: 55,
      schemaType: 'two-pipe-flow-through',
      pipeMaterialId: 'copper-dn15',
      coolantId: 'water'
    })
    const result = runV11Migration(stores as Parameters<typeof runV11Migration>[0])
    // Has old fields → should migrate (not seed)
    expect(result.migrated).toBe(true)
    expect(result.systemId).not.toBeNull()
    const sys = stores.systemStore.getState().systems[result.systemId!]
    expect(sys.tSupply).toBe(75)
    expect(sys.tReturn).toBe(55)
  })

  // Phase 04.2 RCA: defensive `?? []` removed from migration.ts.
  // The invariant "*Order is always an array" is now enforced at the store level
  // via shapeMerge() in safeStorage.ts and verified in systemStore.persist.test.ts
  // (S0..S4 — partial / null / non-array / corrupted-JSON persisted state).
  // Tests for "undefined orders in mock stores" removed: that scenario can no
  // longer occur in production through useSystemStore.getState(), so testing it
  // via raw mocks would be theatre.

  // Phase 04.3: regression — useUfhLoopStore.bulkSetSystemId is single-arg
  // `(systemId)`. Earlier migration mistakenly called `(ids, systemId)` which
  // JS treats as `(systemId=ids[])`, leaving `systemId = []` on every loop.
  // This test fails if the bug returns.
  it('Phase 04.3: sets correct systemId on every UFH loop (record-only store, no order array)', () => {
    const stores = makeEmptyStores()
    // Populate two UFH loops without going through ufhLoopOrder (which doesn't exist).
    Object.assign(stores.ufhLoopStore.getState().loops, {
      'loop-A': { id: 'loop-A', roomId: 'r1' },
      'loop-B': { id: 'loop-B', roomId: 'r2' }
    })
    // Trigger migration via legacy fields so hasMembers picks up Object.keys(loops).
    Object.assign(stores.projectStore.getState(), {
      tSupply: 80, tReturn: 60, schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'steel-vgp-dn20', coolantId: 'water'
    })

    const result = runV11Migration(stores as Parameters<typeof runV11Migration>[0])

    expect(result.migrated).toBe(true)
    expect(typeof result.systemId).toBe('string')
    const loops = stores.ufhLoopStore.getState().loops
    expect((loops['loop-A'] as Record<string, unknown>).systemId).toBe(result.systemId)
    expect((loops['loop-B'] as Record<string, unknown>).systemId).toBe(result.systemId)
    // Anti-regression: ensure systemId is a string, not [] (the historical bug).
    expect(Array.isArray((loops['loop-A'] as Record<string, unknown>).systemId)).toBe(false)
  })
})

describe('migrateV10toV11Json — partial v1.0 fields', () => {
  it('fills DEFAULT_SYSTEM defaults for missing tSupplyUfh/tReturnUfh', () => {
    const input = {
      schemaVersion: '1.0',
      tSupply: 75,
      tReturn: 55,
      // tSupplyUfh, tReturnUfh ОТСУТСТВУЮТ
      schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'steel-vgp-dn20',
      coolantId: 'water',
      rooms: {}, roomOrder: [],
      segments: {}, segmentOrder: [],
      equipment: {}, equipmentOrder: [],
      ufhLoops: {}, ufhLoopOrder: []
    }
    const out = migrateV10toV11Json(input) as Record<string, unknown>
    const system = Object.values(out.systems as Record<string, HeatingSystem>)[0]
    expect(system.tSupply).toBe(75)
    expect(system.tReturn).toBe(55)
    expect(system.tSupplyUfh).toBe(45)  // DEFAULT_SYSTEM fallback
    expect(system.tReturnUfh).toBe(35)  // DEFAULT_SYSTEM fallback
  })

  it('fills DEFAULT_SYSTEM defaults for missing pipeMaterialId/coolantId', () => {
    const input = {
      schemaVersion: '1.0',
      tSupply: 80,
      tReturn: 60,
      // pipeMaterialId, coolantId ОТСУТСТВУЮТ
      rooms: {}, roomOrder: [],
      segments: {}, segmentOrder: [],
      equipment: {}, equipmentOrder: [],
      ufhLoops: {}, ufhLoopOrder: []
    }
    const out = migrateV10toV11Json(input) as Record<string, unknown>
    const system = Object.values(out.systems as Record<string, HeatingSystem>)[0]
    expect(system.pipeMaterialId).toBe(DEFAULT_SYSTEM.pipeMaterialId)  // DEFAULT_SYSTEM fallback
    expect(system.coolantId).toBe(DEFAULT_SYSTEM.coolantId)             // DEFAULT_SYSTEM fallback
  })
})

describe('migrateV10toV11Json', () => {
  const validV10 = {
    schemaVersion: '1.0',
    city: { name: 'Москва', tOutside: -28, gsop: 4551, humidityZone: 'Б' },
    tInside: 20,
    tSupply: 80, tReturn: 60, tSupplyUfh: 45, tReturnUfh: 35,
    schemaType: 'two-pipe-dead-end',
    pipeMaterialId: 'steel-vgp-dn20',
    coolantId: 'water',
    rooms: { 'room-1': { id: 'room-1', name: 'Гостиная', floor: 1 } },
    roomOrder: ['room-1'],
    segments: {
      'seg-1': { id: 'seg-1', name: 'Магистраль', parentSegmentId: null }
    },
    segmentOrder: ['seg-1'],
    equipment: {},
    equipmentOrder: [],
    ufhLoops: {},
    ufhLoopOrder: []
  }

  it('creates "Система 1" block in output JSON shape', () => {
    const out = migrateV10toV11Json(validV10) as Record<string, unknown>
    expect(out.systems).toBeDefined()
    expect(out.systemOrder).toBeDefined()
    expect(Array.isArray(out.systemOrder)).toBe(true)
    expect((out.systemOrder as string[]).length).toBe(1)
    const system = Object.values(out.systems as Record<string, HeatingSystem>)[0]
    expect(system.name).toBe(V11_EXPECTED_SYSTEM_NAME)
    expect(system.tSupply).toBe(80)
    expect(system.schemaType).toBe('two-pipe-dead-end')
  })

  it('segments in output have systemId populated', () => {
    const out = migrateV10toV11Json(validV10) as Record<string, unknown>
    const segments = out.segments as Record<string, Record<string, unknown>>
    const systemId = (out.systemOrder as string[])[0]
    expect(segments['seg-1'].systemId).toBe(systemId)
  })

  it('rejects malicious __proto__/constructor keys', () => {
    const malicious = {
      ...validV10,
      ['__proto__']: { injected: true },
      rooms: { ['__proto__']: { bad: true } }
    }
    expect(() => migrateV10toV11Json(malicious)).toThrow()
  })

  it('round-trip: second migration call is idempotent (same shape)', () => {
    const out1 = migrateV10toV11Json(validV10)
    const out2 = migrateV10toV11Json(out1)
    const sys1 = Object.values((out1 as Record<string, unknown>).systems as Record<string, HeatingSystem>)[0]
    const sys2 = Object.values((out2 as Record<string, unknown>).systems as Record<string, HeatingSystem>)[0]
    expect(sys1.name).toBe(sys2.name)
    expect(sys1.tSupply).toBe(sys2.tSupply)
    expect((out1 as Record<string, unknown>).systemOrder).toEqual((out2 as Record<string, unknown>).systemOrder)
  })

  it('legacy fields are removed from project level after migration', () => {
    const out = migrateV10toV11Json(validV10) as Record<string, unknown>
    for (const field of V11_EXPECTED_PROJECT_FIELDS_REMOVED) {
      expect(out[field]).toBeUndefined()
    }
  })
})
