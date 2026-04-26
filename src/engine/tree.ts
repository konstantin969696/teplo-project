/**
 * engine/tree.ts — D-18 pure segment tree builder.
 * Zero React / store imports. Safe for Web Worker.
 * Threat mitigations: T-04.1-03-04 (MAX_DEPTH clip), cycle guard via visited Set.
 */

import type { Segment } from '../types/hydraulics'

export const MAX_DEPTH = 20

export interface SegmentTreeNode {
  readonly segment: Segment
  readonly id: string
  readonly depth: number
  readonly children: readonly string[]
  /** True если это последний ребёнок своего родителя (для tree-lines └─ vs ├─) */
  readonly isLastSibling: boolean
  /** Для depth > 0: для каждого предка на уровне 0..depth-1 — был ли тот предок последним среди своих siblings.
   *  Используется для отрисовки вертикальных continuation-линий (│) в ветках выше. */
  readonly ancestorIsLast: readonly boolean[]
}

/**
 * D-18 DFS pre-order traversal building a flat list of tree nodes.
 * @param segments  - full segments record (all systems)
 * @param segmentOrder - stable ordering used for root-finding
 * @param systemId  - filter: only segments with this systemId
 * @returns Readonly flat array in DFS pre-order with depth + children ids
 */
export function buildSegmentTree(
  segments: Readonly<Record<string, Segment>>,
  segmentOrder: readonly string[],
  systemId: string
): readonly SegmentTreeNode[] {
  // Filter to system members preserving order
  const inSystem = segmentOrder
    .map(id => segments[id])
    .filter((s): s is Segment => !!s && s.systemId === systemId)

  if (inSystem.length === 0) return []

  // Build children map: parentId → [childIds]
  const childrenMap = new Map<string | null, string[]>()
  for (const seg of inSystem) {
    const key = seg.parentSegmentId
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key)!.push(seg.id)
  }

  const result: SegmentTreeNode[] = []
  const visited = new Set<string>()

  function walk(
    id: string,
    depth: number,
    isLastSibling: boolean,
    ancestorIsLast: readonly boolean[]
  ): void {
    // T-04.1-03-04: MAX_DEPTH clip + cycle guard
    if (visited.has(id) || depth > MAX_DEPTH) return
    visited.add(id)
    const seg = segments[id]
    if (!seg || seg.systemId !== systemId) return
    const children = childrenMap.get(id) ?? []
    result.push({ segment: seg, id: seg.id, depth, children, isLastSibling, ancestorIsLast })
    const nextAncestors = depth === 0 ? [] : [...ancestorIsLast, isLastSibling]
    children.forEach((childId, idx) => {
      walk(childId, depth + 1, idx === children.length - 1, nextAncestors)
    })
  }

  // Walk from roots (parentSegmentId === null)
  const roots = childrenMap.get(null) ?? []
  roots.forEach((rootId, idx) => {
    walk(rootId, 0, idx === roots.length - 1, [])
  })

  // Walk any orphaned nodes (parent outside system or dangling reference)
  const orphans = inSystem.filter(s => !visited.has(s.id))
  orphans.forEach((seg, idx) => {
    walk(seg.id, 0, idx === orphans.length - 1, [])
  })

  return result
}
