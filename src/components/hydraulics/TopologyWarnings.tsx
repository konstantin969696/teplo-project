/**
 * TopologyWarnings — D-08 amber warnings по семантической целостности топологии
 * (UI-SPEC l.286-292). Показывает не-блокирующие замечания для выбранного сегмента.
 *
 * Правила:
 *   1. Две магистрали в системе → warning на каждой.
 *   2. Подводка без стояка в цепочке родителей.
 *   3. Скачок уровня: магистраль → подводка напрямую.
 */

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useSegmentStore } from '../../store/segmentStore'

interface Props {
  readonly segmentId: string
}

export function TopologyWarnings({ segmentId }: Props) {
  const segments = useSegmentStore(s => s.segments)

  const warnings = useMemo<readonly string[]>(() => {
    const seg = segments[segmentId]
    if (!seg) return []
    const all = Object.values(segments).filter(s => s.systemId === seg.systemId)
    const out: string[] = []

    // Rule 1: две магистрали в системе
    const trunks = all.filter(s => s.kind === 'trunk')
    if (seg.kind === 'trunk' && trunks.length > 1) {
      out.push('В системе уже есть магистраль — у неё не должно быть второй')
    }

    // Rule 2: connection без riser в цепочке родителей
    if (seg.kind === 'connection') {
      let parent = seg.parentSegmentId ? segments[seg.parentSegmentId] : null
      let hasRiser = false
      const visited = new Set<string>()
      while (parent && !visited.has(parent.id)) {
        visited.add(parent.id)
        if (parent.kind === 'riser') {
          hasRiser = true
          break
        }
        parent = parent.parentSegmentId ? segments[parent.parentSegmentId] : null
      }
      if (!hasRiser) out.push('Подводка без стояка — проверьте топологию')
    }

    // Rule 3: скачок уровня (trunk → connection без riser посередине)
    if (seg.kind === 'connection' && seg.parentSegmentId) {
      const p = segments[seg.parentSegmentId]
      if (p?.kind === 'trunk') {
        out.push('Скачок уровня: магистраль → подводка без стояка')
      }
    }

    return out
  }, [segments, segmentId])

  if (warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-1 text-xs text-[var(--color-warning)]"
        >
          <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  )
}
