/**
 * SegmentTable — таблица участков гидравлики per-system (Phase 04.1, D-16/D-18/D-19).
 *
 * Рендерит дерево сегментов в pre-order DFS через useSegmentTree(systemId).
 * Для каждого узла:
 *   - paddingLeft inline (8 + depth*16px) — D-18 indent
 *   - chevron (если дети есть) — D-18, локальное collapsed состояние
 *   - SegmentKindIcon — kind-specific 12×12 глиф
 *   - Per-system numbering (D-19) — индекс в видимых узлах +1
 *
 * Wave 3 note: кросс-системный parentSegmentId reject'ится в сторе (D-09);
 * toast вызывается оттуда (см. segmentStore.updateSegment).
 */

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useSegmentTree } from '../../hooks/useSegmentTree'
import { useGckPath } from './useGckPath'
import { SegmentRow } from './SegmentRow'
import { SegmentKindIcon } from './SegmentKindIcon'
import { ColumnHint } from '../ColumnHint'
import { HYDRO_HINTS } from './glossary'
import type { SegmentTreeNode } from '../../engine/tree'

interface Props {
  readonly systemId: string
}

export function SegmentTable({ systemId }: Props) {
  const tree = useSegmentTree(systemId)
  const { segmentResults, gckPath } = useGckPath(systemId)
  const gckSet = useMemo(() => new Set(gckPath), [gckPath])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Build parent chain map for visibility check.
  const parentChain = useMemo(() => {
    const map = new Map<string, readonly string[]>()
    for (const node of tree) {
      const parents: string[] = []
      let current: SegmentTreeNode | undefined = node
      while (current && current.segment.parentSegmentId) {
        const parentId: string = current.segment.parentSegmentId
        parents.push(parentId)
        current = tree.find(n => n.segment.id === parentId)
      }
      map.set(node.segment.id, parents)
    }
    return map
  }, [tree])

  const visibleNodes = useMemo(() => {
    return tree.filter(node => {
      const parents = parentChain.get(node.segment.id) ?? []
      return !parents.some(pid => collapsed.has(pid))
    })
  }, [tree, parentChain, collapsed])

  const toggleCollapsed = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-x-auto" data-testid="segment-table">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="h-8 text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
            <th className="w-6"></th>
            <th className="w-10 text-center">№</th>
            <th className="text-left px-2">Назначение</th>
            <th className="w-20 text-right px-2"><ColumnHint label="Q, Вт" hint={HYDRO_HINTS.Q} /></th>
            <th className="w-16 text-right px-2"><ColumnHint label="L, м" hint={HYDRO_HINTS.L} /></th>
            <th className="w-20 text-right px-2"><ColumnHint label="d_пр, мм" hint={HYDRO_HINTS.d_pr} /></th>
            <th className="w-20 text-right px-2"><ColumnHint label="v, м/с" hint={HYDRO_HINTS.v} /></th>
            <th className="w-20 text-right px-2"><ColumnHint label="ΔP, Па" hint={HYDRO_HINTS.deltaP} /></th>
            <th className="w-14"></th>
          </tr>
        </thead>
        <tbody>
          {visibleNodes.map((node, idx) => {
            const hasChildren = node.children.length > 0
            const isCollapsed = collapsed.has(node.segment.id)
            return (
              <SegmentRow
                key={node.segment.id}
                segmentId={node.segment.id}
                index={idx}
                depth={node.depth}
                hasChildren={hasChildren}
                isCollapsed={isCollapsed}
                onToggleCollapsed={() => toggleCollapsed(node.segment.id)}
                calcResult={segmentResults[node.segment.id]}
                isInMainCircuit={gckSet.has(node.segment.id)}
                isLastSibling={node.isLastSibling}
                ancestorIsLast={node.ancestorIsLast}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Export для переиспользования в SegmentRow (render indent + icon + chevron).
export { ChevronRight as _ChevronRightForRow, SegmentKindIcon as _SegmentKindIconForRow }
