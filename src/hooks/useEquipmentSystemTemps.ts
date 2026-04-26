/**
 * useEquipmentSystemTemps — D-27 aware selector.
 * Возвращает tSupply/tReturn системы, к которой привязан прибор.
 * Fallback 80/60 если system не найдена (ошибка целостности).
 *
 * Pattern: SP-4 Derived Selector Hook (PATTERNS.md §10).
 */

import { useMemo } from 'react'
import { useEquipmentStore } from '../store/equipmentStore'
import { useSystemStore } from '../store/systemStore'

export function useEquipmentSystemTemps(equipmentId: string): {
  readonly tSupply: number
  readonly tReturn: number
} {
  const systemId = useEquipmentStore(s => (s.equipment[equipmentId] as unknown as { systemId?: string | null })?.systemId)
  const system = useSystemStore(s => systemId ? s.systems[systemId] : undefined)
  return useMemo(() => ({
    tSupply: system?.tSupply ?? 80,
    tReturn: system?.tReturn ?? 60
  }), [system?.tSupply, system?.tReturn])
}
