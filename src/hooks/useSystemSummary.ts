/**
 * useSystemSummary — summary для SystemAccordion header.
 * Consumer'ит модифицированный useGckPath(systemId) из Task 1.
 *
 * Pattern: SP-4 Derived Selector Hook (PATTERNS.md §12).
 */

import { useMemo } from 'react'
import { useSegmentStore } from '../store/segmentStore'
import { useGckPath } from '../components/hydraulics/useGckPath'

export interface SystemSummary {
  readonly segmentsCount: number
  readonly deltaPKpa: number | null
  readonly pumpModel: string | null
}

export function useSystemSummary(systemId: string): SystemSummary {
  const segments = useSegmentStore(s => s.segments)
  const gckResult = useGckPath(systemId)

  return useMemo(() => {
    const count = Object.values(segments).filter(s => (s as unknown as { systemId?: string }).systemId === systemId).length
    const deltaPPa = gckResult.deltaPGckPa > 0 ? gckResult.deltaPGckPa : null
    return {
      segmentsCount: count,
      deltaPKpa: deltaPPa != null ? Math.round(deltaPPa / 100) / 10 : null,
      pumpModel: null  // pumpModel computed separately via recommendPump — not in GckComputationResult
    }
  }, [segments, systemId, gckResult])
}
