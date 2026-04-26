/**
 * engine/equipmentSystemTemps.ts — pure helper для D-27.
 * Возвращает tSupply/tReturn системы, к которой привязан прибор.
 * Pure TS — zero React, safe for Web Worker.
 *
 * Created in Plan 04 worktree (Plan 03 parallel wave).
 * After Wave 2 merge the Plan 03 version will replace this stub.
 */

import type { Equipment } from '../types/project'
import type { HeatingSystem } from '../types/system'

const FALLBACK_T_SUPPLY = 80
const FALLBACK_T_RETURN = 60

export interface EquipmentSystemTemps {
  readonly tSupply: number
  readonly tReturn: number
}

/**
 * D-27: Возвращает температуры из системы прибора.
 * Fallback 80/60 если equipmentId не найден или systemId не найден в systemMap.
 */
export function getEquipmentSystemTemps(
  equipmentId: string,
  equipmentMap: Readonly<Record<string, Equipment>>,
  systemMap: Readonly<Record<string, HeatingSystem>>
): EquipmentSystemTemps {
  const eq = equipmentMap[equipmentId]
  if (!eq) return { tSupply: FALLBACK_T_SUPPLY, tReturn: FALLBACK_T_RETURN }

  const systemId = (eq as unknown as { systemId?: string | null }).systemId
  if (!systemId) return { tSupply: FALLBACK_T_SUPPLY, tReturn: FALLBACK_T_RETURN }

  const system = systemMap[systemId]
  if (!system) return { tSupply: FALLBACK_T_SUPPLY, tReturn: FALLBACK_T_RETURN }

  return { tSupply: system.tSupply, tReturn: system.tReturn }
}
