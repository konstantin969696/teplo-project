/**
 * Generic seed+overrides merge helper for editable catalogs.
 * Phase 4 pattern — extracted from Phase 3 catalogStore.ts to avoid duplication
 * across pipe/kms/coolant stores.
 *
 * Threat mitigation: T-04-07 — persists only userOverrides + deletedSeedIds,
 * not the full merged catalog, keeping localStorage footprint minimal.
 */

export interface CatalogItem {
  readonly id: string
  readonly isCustom: boolean
}

/**
 * Merge seed catalog with user overrides and deletions.
 *
 * Algorithm (order matters):
 *   1. Start with seed (all isCustom=false)
 *   2. Remove deletedSeedIds entries
 *   3. Apply userOverrides (may add new items or replace seed items)
 *
 * Custom items (isCustom=true) added by user are in userOverrides only —
 * they are not in seedById, so deletedSeedIds has no effect on them.
 */
export function mergeSeedWithOverrides<T extends CatalogItem>(
  seedById: Readonly<Record<string, T>>,
  overrides: Readonly<Record<string, T>>,
  deletedSeedIds: readonly string[]
): Record<string, T> {
  const merged: Record<string, T> = { ...seedById }
  for (const delId of deletedSeedIds) delete merged[delId]
  for (const [id, m] of Object.entries(overrides)) merged[id] = m
  return merged
}
