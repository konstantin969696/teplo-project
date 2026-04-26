/**
 * RED scaffold: getEquipmentSystemTemps pure helper.
 * Tests WILL FAIL until engine/equipmentSystemTemps.ts is implemented in Plan 04.
 *
 * Tests pure helper (not React hook) — easier to unit test.
 */

import { describe, it, expect } from 'vitest'
import { getEquipmentSystemTemps } from '../engine/equipmentSystemTemps'
import type { HeatingSystem } from '../types/system'
import type { Equipment } from '../types/project'

const makeEquipment = (id: string, overrides: Partial<Equipment> = {}): Equipment => ({
  id,
  roomId: 'room-1',
  kind: 'bimetal',
  catalogModelId: null,
  connection: 'side',
  installation: 'open',
  panelType: null,
  panelHeightMm: null,
  panelLengthMm: null,
  sectionsOverride: null,
  convectorLengthMm: null,
  manualQNominal: null,
  manualNExponent: null,
  systemId: null,
  ...overrides
} as unknown as Equipment)

const makeSystem = (id: string, tSupply: number, tReturn: number): HeatingSystem => ({
  id,
  name: 'Тест',
  schemaType: 'two-pipe-dead-end',
  pipeMaterialId: 'steel-vgp-dn20',
  coolantId: 'water',
  tSupply,
  tReturn,
  tSupplyUfh: 45,
  tReturnUfh: 35,
  sourceLabel: ''
} as HeatingSystem)

describe('getEquipmentSystemTemps', () => {
  it('returns system.tSupply/tReturn when equipment has valid systemId', () => {
    const equipment = makeEquipment('eq-1', { systemId: 'sys-1' } as unknown as Partial<Equipment>)
    const systemMap = { 'sys-1': makeSystem('sys-1', 80, 60) }

    const result = getEquipmentSystemTemps('eq-1', { 'eq-1': equipment }, systemMap)
    expect(result.tSupply).toBe(80)
    expect(result.tReturn).toBe(60)
  })

  it('fallback to 80/60 when systemId not found in systemMap', () => {
    const equipment = makeEquipment('eq-1', { systemId: 'sys-unknown' } as unknown as Partial<Equipment>)
    const systemMap = { 'sys-other': makeSystem('sys-other', 70, 50) }

    const result = getEquipmentSystemTemps('eq-1', { 'eq-1': equipment }, systemMap)
    expect(result.tSupply).toBe(80)
    expect(result.tReturn).toBe(60)
  })

  it('fallback to 80/60 when equipment not found', () => {
    const systemMap = { 'sys-1': makeSystem('sys-1', 75, 55) }

    const result = getEquipmentSystemTemps('eq-nonexistent', {}, systemMap)
    expect(result.tSupply).toBe(80)
    expect(result.tReturn).toBe(60)
  })

  it('fallback to 80/60 when equipment has null systemId', () => {
    const equipment = makeEquipment('eq-1') // systemId: null
    const systemMap = { 'sys-1': makeSystem('sys-1', 75, 55) }

    const result = getEquipmentSystemTemps('eq-1', { 'eq-1': equipment }, systemMap)
    expect(result.tSupply).toBe(80)
    expect(result.tReturn).toBe(60)
  })

  it('handles multiple systems — picks correct one by systemId', () => {
    const equipment = makeEquipment('eq-2', { systemId: 'sys-B' } as unknown as Partial<Equipment>)
    const systemMap = {
      'sys-A': makeSystem('sys-A', 80, 60),
      'sys-B': makeSystem('sys-B', 70, 50)
    }

    const result = getEquipmentSystemTemps('eq-2', { 'eq-2': equipment }, systemMap)
    expect(result.tSupply).toBe(70)
    expect(result.tReturn).toBe(50)
  })
})
