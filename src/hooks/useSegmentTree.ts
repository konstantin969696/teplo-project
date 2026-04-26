/**
 * useSegmentTree — D-18 derived tree view для SegmentTable.
 * Возвращает pre-order SegmentTreeNode[] memoized по [segments, segmentOrder, systemId].
 *
 * Pattern: SP-4 Derived Selector Hook (PATTERNS.md §11).
 * Uses buildSegmentTree from engine/tree.ts (pure, Web-Worker-safe).
 */

import { useMemo } from 'react'
import { useSegmentStore } from '../store/segmentStore'
import { buildSegmentTree } from '../engine/tree'

export type { SegmentTreeNode } from '../engine/tree'

export function useSegmentTree(systemId: string): readonly import('../engine/tree').SegmentTreeNode[] {
  const segments = useSegmentStore(s => s.segments)
  const segmentOrder = useSegmentStore(s => s.segmentOrder)
  return useMemo(
    () => buildSegmentTree(segments, segmentOrder, systemId),
    [segments, segmentOrder, systemId]
  )
}
