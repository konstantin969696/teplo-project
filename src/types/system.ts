/** Phase 04.1 types — HeatingSystem + SystemState. */

import type { SchemaType } from './hydraulics'

/**
 * Represents a named heating system within the project.
 * D-02: all hydraulic + temperature params are per-system (not global).
 */
export interface HeatingSystem {
  readonly id: string
  readonly name: string
  readonly schemaType: SchemaType
  readonly pipeMaterialId: string      // ref to pipeCatalog (default: steel-vgp-dn20)
  readonly coolantId: string           // ref to coolantCatalog (default: water)
  readonly tSupply: number             // °C, radiator supply (D-13 default 80)
  readonly tReturn: number             // °C, radiator return (D-13 default 60)
  readonly tSupplyUfh: number          // °C, UFH supply (D-14 default 45)
  readonly tReturnUfh: number          // °C, UFH return (D-14 default 35)
  readonly sourceLabel: string         // D-05: free text for PDF ("Котёл газ. 1"), '' by default
}

/**
 * Zustand store state for HeatingSystem CRUD.
 * Follows the normalized store pattern (equipmentStore analog).
 */
export interface SystemState {
  readonly systems: Record<string, HeatingSystem>
  readonly systemOrder: readonly string[]
  addSystem: (sys: Omit<HeatingSystem, 'id'>) => string
  updateSystem: (id: string, changes: Partial<Omit<HeatingSystem, 'id'>>) => void
  deleteSystem: (id: string) => void
  reorderSystems: (order: readonly string[]) => void
}

/**
 * Default field values for a new HeatingSystem (excluding id and name).
 * D-26: used for initial seed and migration (runV11Migration).
 */
export const DEFAULT_SYSTEM: Omit<HeatingSystem, 'id' | 'name'> = {
  schemaType: 'two-pipe-dead-end',
  pipeMaterialId: 'steel-vgp-dn20',
  coolantId: 'water',
  tSupply: 80,
  tReturn: 60,
  tSupplyUfh: 45,
  tReturnUfh: 35,
  sourceLabel: ''
}
