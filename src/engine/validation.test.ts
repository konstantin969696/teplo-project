import { describe, it, expect } from 'vitest'
import {
  validateProjectJSON,
  validateEquipmentJSON,
  validateCatalogJSON,
  validateSegmentJSON,
  validateUfhLoopJSON,
  validatePipeCatalogJSON,
  validateKmsCatalogJSON,
  validateCoolantCatalogJSON
} from './validation'

describe('validateProjectJSON', () => {
  const validProject = {
    city: { name: 'Москва', tOutside: -28, gsop: 4943, humidityZone: 'Б' },
    tInside: 20,
    rooms: {},
    roomOrder: [],
  }

  it('accepts valid project data', () => {
    expect(validateProjectJSON(validProject)).toBe(true)
  })

  it('accepts project with null city', () => {
    expect(validateProjectJSON({ ...validProject, city: null })).toBe(true)
  })

  it('rejects null', () => {
    expect(validateProjectJSON(null)).toBe(false)
  })

  it('rejects string', () => {
    expect(validateProjectJSON('not an object')).toBe(false)
  })

  it('rejects missing tInside', () => {
    expect(validateProjectJSON({ ...validProject, tInside: undefined })).toBe(false)
  })

  it('rejects tInside out of range (too low)', () => {
    expect(validateProjectJSON({ ...validProject, tInside: 5 })).toBe(false)
  })

  it('rejects tInside out of range (too high)', () => {
    expect(validateProjectJSON({ ...validProject, tInside: 35 })).toBe(false)
  })

  it('rejects invalid city humidityZone', () => {
    const bad = { ...validProject, city: { ...validProject.city, humidityZone: 'Г' } }
    expect(validateProjectJSON(bad)).toBe(false)
  })

  it('rejects missing rooms', () => {
    const { rooms: _rooms, ...rest } = validProject
    expect(validateProjectJSON(rest)).toBe(false)
  })

  it('rejects roomOrder not array', () => {
    expect(validateProjectJSON({ ...validProject, roomOrder: 'bad' })).toBe(false)
  })

  describe('room validation', () => {
    it('validates rooms with required fields', () => {
      const data = {
        ...validProject,
        rooms: {
          'r1': { id: 'r1', name: 'Комната', floor: 1, area: 18, height: 2.7 }
        },
        roomOrder: ['r1']
      }
      expect(validateProjectJSON(data)).toBe(true)
    })

    it('rejects room missing id', () => {
      const data = {
        ...validProject,
        rooms: {
          'r1': { name: 'Комната', floor: 1, area: 18, height: 2.7 }
        },
        roomOrder: ['r1']
      }
      expect(validateProjectJSON(data)).toBe(false)
    })

    it('rejects room with non-string name', () => {
      const data = {
        ...validProject,
        rooms: {
          'r1': { id: 'r1', name: 123, floor: 1, area: 18, height: 2.7 }
        },
        roomOrder: ['r1']
      }
      expect(validateProjectJSON(data)).toBe(false)
    })

    it('rejects room with non-number area', () => {
      const data = {
        ...validProject,
        rooms: {
          'r1': { id: 'r1', name: 'Комната', floor: 1, area: 'big', height: 2.7 }
        },
        roomOrder: ['r1']
      }
      expect(validateProjectJSON(data)).toBe(false)
    })

    it('accepts room with Phase 2 fields present', () => {
      const data = {
        ...validProject,
        rooms: {
          'r1': {
            id: 'r1', name: 'Комната', floor: 1, area: 18, height: 2.7,
            isCorner: true, infiltrationMethod: 'rate', nInfiltration: 0.5,
            gapArea: null, windSpeed: null, lVentilation: 0
          }
        },
        roomOrder: ['r1']
      }
      expect(validateProjectJSON(data)).toBe(true)
    })
  })

  describe('Phase 3: tSupply/tReturn', () => {
    const base = {
      city: null,
      tInside: 20,
      rooms: {},
      roomOrder: []
    }

    it('accepts payload without tSupply/tReturn (Phase 1/2 backward-compat)', () => {
      expect(validateProjectJSON(base)).toBe(true)
    })

    it('accepts valid tSupply=85 and tReturn=65', () => {
      expect(validateProjectJSON({ ...base, tSupply: 85, tReturn: 65 })).toBe(true)
    })

    it('rejects tSupply out of range (200)', () => {
      expect(validateProjectJSON({ ...base, tSupply: 200 })).toBe(false)
    })

    it('rejects tSupply with non-number type', () => {
      expect(validateProjectJSON({ ...base, tSupply: 'abc' })).toBe(false)
    })

    it('rejects NaN tSupply', () => {
      expect(validateProjectJSON({ ...base, tSupply: NaN })).toBe(false)
    })

    it('rejects tReturn too low', () => {
      expect(validateProjectJSON({ ...base, tReturn: 5 })).toBe(false)
    })
  })
})

describe('validateEquipmentJSON', () => {
  const validEquipment = {
    id: 'eq-1',
    roomId: 'room-1',
    kind: 'bimetal',
    catalogModelId: 'rifar-base-500',
    connection: 'side',
    installation: 'open',
    panelType: null,
    panelHeightMm: null,
    panelLengthMm: null,
    sectionsOverride: null,
    convectorLengthMm: null,
    manualQNominal: null,
    manualNExponent: null
  }

  it('accepts valid equipment payload', () => {
    expect(validateEquipmentJSON({
      equipment: { 'eq-1': validEquipment },
      equipmentOrder: ['eq-1']
    })).toBe(true)
  })

  it('accepts empty equipment', () => {
    expect(validateEquipmentJSON({ equipment: {}, equipmentOrder: [] })).toBe(true)
  })

  it('rejects invalid kind', () => {
    expect(validateEquipmentJSON({
      equipment: { 'eq-1': { ...validEquipment, kind: 'invalid-kind' } },
      equipmentOrder: ['eq-1']
    })).toBe(false)
  })

  it('rejects invalid connection', () => {
    expect(validateEquipmentJSON({
      equipment: { 'eq-1': { ...validEquipment, connection: 'whatever' } },
      equipmentOrder: ['eq-1']
    })).toBe(false)
  })

  it('rejects missing roomId', () => {
    const { roomId: _rid, ...eqNoRoom } = validEquipment
    expect(validateEquipmentJSON({
      equipment: { 'eq-1': eqNoRoom },
      equipmentOrder: ['eq-1']
    })).toBe(false)
  })

  it('rejects prototype pollution via __proto__ key (T-3-02)', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "equipment": {}, "equipmentOrder": []}')
    expect(validateEquipmentJSON(malicious)).toBe(false)
  })

  it('rejects mismatched equipmentOrder (id references missing equipment)', () => {
    expect(validateEquipmentJSON({
      equipment: { 'eq-1': validEquipment },
      equipmentOrder: ['eq-1', 'eq-ghost']
    })).toBe(false)
  })

  it('rejects invalid sectionsOverride (< 1)', () => {
    expect(validateEquipmentJSON({
      equipment: { 'eq-1': { ...validEquipment, sectionsOverride: 0 } },
      equipmentOrder: ['eq-1']
    })).toBe(false)
  })

  it('rejects out-of-range manualNExponent (5)', () => {
    expect(validateEquipmentJSON({
      equipment: { 'eq-1': { ...validEquipment, manualNExponent: 5 } },
      equipmentOrder: ['eq-1']
    })).toBe(false)
  })
})

describe('validateCatalogJSON', () => {
  const validSectional = {
    id: 'custom-1',
    manufacturer: 'Test',
    series: 'X',
    kind: 'bimetal',
    nExponent: 1.3,
    isCustom: true,
    qPerSectionAt70: 200,
    heightMm: 500,
    sectionWidthMm: 80,
    maxSections: 14
  }

  it('accepts empty catalog', () => {
    expect(validateCatalogJSON({ userOverrides: {}, deletedSeedIds: [] })).toBe(true)
  })

  it('accepts catalog with valid sectional override', () => {
    expect(validateCatalogJSON({
      userOverrides: { 'custom-1': validSectional },
      deletedSeedIds: []
    })).toBe(true)
  })

  it('rejects invalid kind', () => {
    expect(validateCatalogJSON({
      userOverrides: { 'custom-1': { ...validSectional, kind: 'unknown' } },
      deletedSeedIds: []
    })).toBe(false)
  })

  it('rejects qPerSectionAt70 <= 0', () => {
    expect(validateCatalogJSON({
      userOverrides: { 'custom-1': { ...validSectional, qPerSectionAt70: -1 } },
      deletedSeedIds: []
    })).toBe(false)
  })

  it('rejects nExponent out of range (5)', () => {
    expect(validateCatalogJSON({
      userOverrides: { 'custom-1': { ...validSectional, nExponent: 5 } },
      deletedSeedIds: []
    })).toBe(false)
  })

  it('rejects prototype pollution via __proto__ key (T-3-02)', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "userOverrides": {}, "deletedSeedIds": []}')
    expect(validateCatalogJSON(malicious)).toBe(false)
  })

  it('rejects deletedSeedIds not array', () => {
    expect(validateCatalogJSON({ userOverrides: {}, deletedSeedIds: 'bad' })).toBe(false)
  })

  it('rejects panel override with missing variants array', () => {
    expect(validateCatalogJSON({
      userOverrides: {
        'p1': {
          id: 'p1', manufacturer: 'A', series: 'B', kind: 'panel',
          nExponent: 1.3, isCustom: true, panelType: '22'
        }
      },
      deletedSeedIds: []
    })).toBe(false)
  })

  it('accepts valid panel override', () => {
    expect(validateCatalogJSON({
      userOverrides: {
        'p1': {
          id: 'p1', manufacturer: 'A', series: 'B', kind: 'panel',
          nExponent: 1.3, isCustom: true, panelType: '22',
          variants: [{ heightMm: 500, lengthMm: 1000, qAt70: 1600 }]
        }
      },
      deletedSeedIds: []
    })).toBe(true)
  })
})

// ============================================================
// Phase 4 validators
// ============================================================

describe('validateSegmentJSON', () => {
  const validSegment = {
    id: 'seg-1',
    parentSegmentId: null,
    name: 'Магистраль',
    equipmentId: null,
    qOverride: null,
    lengthM: 10,
    pipeId: 'steel-vgp-dn20',
    dnMm: 20,
    kmsCounts: { 'elbow-90-smooth': 2 },
    velocityTargetMS: 0.6
  }

  it('Test 15a: accepts valid segment payload', () => {
    expect(validateSegmentJSON({
      segments: { 'seg-1': validSegment },
      segmentOrder: ['seg-1']
    })).toBe(true)
  })

  it('Test 15b: accepts empty segments', () => {
    expect(validateSegmentJSON({ segments: {}, segmentOrder: [] })).toBe(true)
  })

  it('Test 15c: rejects __proto__ pollution at top level (T-04-05)', () => {
    const malicious = JSON.parse('{"__proto__": {"x": 1}, "segments": {}, "segmentOrder": []}')
    expect(validateSegmentJSON(malicious)).toBe(false)
  })

  it('rejects segment with mismatched id', () => {
    expect(validateSegmentJSON({
      segments: { 'seg-1': { ...validSegment, id: 'seg-2' } },
      segmentOrder: ['seg-1']
    })).toBe(false)
  })

  it('rejects segment with invalid velocityTargetMS (>5)', () => {
    expect(validateSegmentJSON({
      segments: { 'seg-1': { ...validSegment, velocityTargetMS: 10 } },
      segmentOrder: ['seg-1']
    })).toBe(false)
  })

  it('rejects segment with negative lengthM', () => {
    expect(validateSegmentJSON({
      segments: { 'seg-1': { ...validSegment, lengthM: -1 } },
      segmentOrder: ['seg-1']
    })).toBe(false)
  })

  it('rejects missing segmentOrder array', () => {
    expect(validateSegmentJSON({ segments: {} })).toBe(false)
  })

  it('rejects null data', () => {
    expect(validateSegmentJSON(null)).toBe(false)
  })
})

describe('validateUfhLoopJSON', () => {
  const validLoop = {
    id: 'loop-1',
    roomId: 'room-1',
    enabled: true,
    activeAreaM2: 12,
    covering: 'tile',
    pipeId: 'pe-x-16-2',
    stepCm: 20,
    leadInM: 3
  }

  it('Test 16a: accepts valid UFH loop payload', () => {
    expect(validateUfhLoopJSON({
      loops: { 'loop-1': validLoop },
      loopsByRoom: { 'room-1': 'loop-1' }
    })).toBe(true)
  })

  it('Test 16b: accepts empty loops', () => {
    expect(validateUfhLoopJSON({ loops: {}, loopsByRoom: {} })).toBe(true)
  })

  it('Test 16c: rejects __proto__ pollution (T-04-05)', () => {
    const malicious = JSON.parse('{"__proto__": {"x": 1}, "loops": {}, "loopsByRoom": {}}')
    expect(validateUfhLoopJSON(malicious)).toBe(false)
  })

  it('rejects invalid covering value', () => {
    expect(validateUfhLoopJSON({
      loops: { 'loop-1': { ...validLoop, covering: 'carpet' } },
      loopsByRoom: { 'room-1': 'loop-1' }
    })).toBe(false)
  })

  it('rejects stepCm out of range (<5)', () => {
    expect(validateUfhLoopJSON({
      loops: { 'loop-1': { ...validLoop, stepCm: 3 } },
      loopsByRoom: {}
    })).toBe(false)
  })

  it('rejects activeAreaM2 > 10000', () => {
    expect(validateUfhLoopJSON({
      loops: { 'loop-1': { ...validLoop, activeAreaM2: 99999 } },
      loopsByRoom: {}
    })).toBe(false)
  })

  it('rejects mismatched loop id', () => {
    expect(validateUfhLoopJSON({
      loops: { 'loop-1': { ...validLoop, id: 'loop-X' } },
      loopsByRoom: {}
    })).toBe(false)
  })
})

describe('validatePipeCatalogJSON', () => {
  const validPipe = {
    id: 'custom-pipe',
    material: 'pe-x',
    dnMm: 16,
    innerDiameterMm: 12,
    roughnessMm: 0.007,
    wallThicknessMm: 2,
    maxLoopLengthM: 90,
    isCustom: true
  }

  it('accepts empty overrides', () => {
    expect(validatePipeCatalogJSON({ userOverrides: {}, deletedSeedIds: [] })).toBe(true)
  })

  it('accepts valid pipe override', () => {
    expect(validatePipeCatalogJSON({
      userOverrides: { 'custom-pipe': validPipe },
      deletedSeedIds: ['steel-vgp-dn15']
    })).toBe(true)
  })

  it('accepts maxLoopLengthM=null', () => {
    expect(validatePipeCatalogJSON({
      userOverrides: { 'custom-pipe': { ...validPipe, maxLoopLengthM: null } },
      deletedSeedIds: []
    })).toBe(true)
  })

  it('rejects invalid material', () => {
    expect(validatePipeCatalogJSON({
      userOverrides: { 'custom-pipe': { ...validPipe, material: 'titanium' } },
      deletedSeedIds: []
    })).toBe(false)
  })

  it('rejects __proto__ pollution (T-04-05)', () => {
    const malicious = JSON.parse('{"__proto__": {"x": 1}, "userOverrides": {}, "deletedSeedIds": []}')
    expect(validatePipeCatalogJSON(malicious)).toBe(false)
  })
})

describe('validateKmsCatalogJSON', () => {
  const validKms = {
    id: 'custom-kms',
    name: 'Угловой кран',
    zeta: 1.8,
    isCustom: true
  }

  it('accepts empty overrides', () => {
    expect(validateKmsCatalogJSON({ userOverrides: {}, deletedSeedIds: [] })).toBe(true)
  })

  it('accepts valid KMS override', () => {
    expect(validateKmsCatalogJSON({
      userOverrides: { 'custom-kms': validKms },
      deletedSeedIds: []
    })).toBe(true)
  })

  it('rejects negative zeta', () => {
    expect(validateKmsCatalogJSON({
      userOverrides: { 'custom-kms': { ...validKms, zeta: -1 } },
      deletedSeedIds: []
    })).toBe(false)
  })

  it('rejects __proto__ pollution (T-04-05)', () => {
    const malicious = JSON.parse('{"__proto__": {"x": 1}, "userOverrides": {}, "deletedSeedIds": []}')
    expect(validateKmsCatalogJSON(malicious)).toBe(false)
  })
})

describe('validateCoolantCatalogJSON', () => {
  const validCoolant = {
    id: 'custom-coolant',
    name: 'Гликоль 50%',
    rhoKgM3: 1070,
    cKjKgK: 3.5,
    nuM2S: 2.0e-6,
    isCustom: true
  }

  it('accepts empty overrides', () => {
    expect(validateCoolantCatalogJSON({ userOverrides: {}, deletedSeedIds: [] })).toBe(true)
  })

  it('accepts valid coolant override', () => {
    expect(validateCoolantCatalogJSON({
      userOverrides: { 'custom-coolant': validCoolant },
      deletedSeedIds: []
    })).toBe(true)
  })

  it('rejects rhoKgM3 <= 0', () => {
    expect(validateCoolantCatalogJSON({
      userOverrides: { 'custom-coolant': { ...validCoolant, rhoKgM3: 0 } },
      deletedSeedIds: []
    })).toBe(false)
  })

  it('rejects __proto__ pollution (T-04-05)', () => {
    const malicious = JSON.parse('{"__proto__": {"x": 1}, "userOverrides": {}, "deletedSeedIds": []}')
    expect(validateCoolantCatalogJSON(malicious)).toBe(false)
  })
})

describe('validateProjectJSON Phase 4 fields', () => {
  const base = { city: null, tInside: 20, rooms: {}, roomOrder: [] }

  it('Test 17a: accepts project without Phase 4 fields (backward-compat)', () => {
    expect(validateProjectJSON(base)).toBe(true)
  })

  it('Test 17b: accepts project with valid Phase 4 fields', () => {
    expect(validateProjectJSON({
      ...base,
      schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'steel-vgp-dn20',
      coolantId: 'water',
      tSupplyUfh: 45,
      tReturnUfh: 35
    })).toBe(true)
  })

  it('rejects invalid schemaType', () => {
    expect(validateProjectJSON({ ...base, schemaType: 'radiant' })).toBe(false)
  })

  it('rejects empty pipeMaterialId', () => {
    expect(validateProjectJSON({ ...base, pipeMaterialId: '' })).toBe(false)
  })

  it('rejects empty coolantId', () => {
    expect(validateProjectJSON({ ...base, coolantId: '' })).toBe(false)
  })

  it('rejects tSupplyUfh out of range (>80)', () => {
    expect(validateProjectJSON({ ...base, tSupplyUfh: 100 })).toBe(false)
  })

  it('rejects tReturnUfh out of range (<15)', () => {
    expect(validateProjectJSON({ ...base, tReturnUfh: 10 })).toBe(false)
  })

  it('accepts all valid schemaType values', () => {
    const types = ['two-pipe-dead-end', 'two-pipe-flow-through', 'manifold', 'single-pipe']
    for (const t of types) {
      expect(validateProjectJSON({ ...base, schemaType: t })).toBe(true)
    }
  })
})
