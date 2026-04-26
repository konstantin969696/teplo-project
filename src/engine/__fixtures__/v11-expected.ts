/**
 * Expected v1.1 shape after migration from v1.0.
 * Used by migration.test.ts for round-trip assertions.
 *
 * After migration:
 *   - systems / systemOrder appear in JSON
 *   - System gets the 7 fields from v1.0 project level
 *   - Project-level v1.0 fields are REMOVED
 *   - All segments/equipment/ufhLoops get systemId
 */

import type { SchemaType } from '../../types/hydraulics'

// Expected system name created by migration
export const V11_EXPECTED_SYSTEM_NAME = 'Система 1' as const

// Expected system fields after migrating V10_PROJECT_STATE
export const V11_EXPECTED_SYSTEM_FIELDS = {
  name: 'Система 1',
  schemaType: 'two-pipe-dead-end' as SchemaType,
  pipeMaterialId: 'steel-vgp-dn20',
  coolantId: 'water',
  tSupply: 80,
  tReturn: 60,
  tSupplyUfh: 45,
  tReturnUfh: 35,
  sourceLabel: ''
} as const

// These fields MUST be absent from project root after migration
// (they've been moved to the System object)
export const V11_EXPECTED_PROJECT_FIELDS_REMOVED = [
  'schemaType',
  'pipeMaterialId',
  'coolantId',
  'tSupply',
  'tReturn',
  'tSupplyUfh',
  'tReturnUfh'
] as const

// Expected schemaVersion after migration
export const V11_EXPECTED_SCHEMA_VERSION = '1.1' as const

// Expected segments shape: each segment gets systemId
export const V11_EXPECTED_SEGMENT_FIELDS = {
  'seg-1': { systemId: 'MIGRATED_SYSTEM_ID' }, // actual id filled at runtime
  'seg-2': { systemId: 'MIGRATED_SYSTEM_ID' }
} as const
