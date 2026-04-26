/**
 * useUfhSystemTemps — aware selector для петель тёплого пола.
 * Возвращает tSupply/tReturn из системы, к которой привязана петля.
 * Fallback 45/35 если system не найдена.
 *
 * Pattern: SP-4 Derived Selector Hook (PATTERNS.md §10 — аналог useEquipmentSystemTemps).
 */

import { useMemo } from 'react'
import { useUfhLoopStore } from '../store/ufhLoopStore'
import { useSystemStore } from '../store/systemStore'

export function useUfhSystemTemps(loopId: string): {
  readonly tSupply: number
  readonly tReturn: number
} {
  const systemId = useUfhLoopStore(s => (s.loops[loopId] as unknown as { systemId?: string | null })?.systemId)
  const system = useSystemStore(s => systemId ? s.systems[systemId] : undefined)
  return useMemo(() => ({
    tSupply: system?.tSupplyUfh ?? 45,
    tReturn: system?.tReturnUfh ?? 35
  }), [system?.tSupplyUfh, system?.tReturnUfh])
}
