/**
 * SystemAccordion — collapsible секция per-система (UI-SPEC l.224-238, D-16).
 *
 * Header: chevron + имя + summary (schema · pipe · coolant · N сегм · ΔP_ГЦК · Насос) + кнопка удаления.
 * Keyboard: Enter/Space toggles expansion.
 *
 * Content:
 *   - variant="hydraulics" → SystemCard + SegmentTable + PumpRecommendation + BalancingBlock
 *   - variant="ufh"        → SystemCard + UfhTable (Plan 06 — пока stub)
 *
 * Delete icon в header: stopPropagation + тот же ConfirmDialog что в SystemCard.
 */

import { useMemo, useState } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSystemStore } from '../../store/systemStore'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { useSystemSummary } from '../../hooks/useSystemSummary'
import { cascadeDeleteSystem, getCascadeDeleteCounts } from '../../hooks/cascadeDeleteSystem'
import { SCHEMA_LABELS, PIPE_MATERIAL_LABELS } from './hydraulics-help'
import { SystemCard } from './SystemCard'
import { SegmentTable } from './SegmentTable'
import { PumpRecommendation } from './PumpRecommendation'
import { BalancingBlock } from './BalancingBlock'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { UfhTable } from '../ufh/UfhTable'

interface Props {
  readonly systemId: string
  readonly variant?: 'hydraulics' | 'ufh'
  readonly defaultExpanded?: boolean
}

export function SystemAccordion({ systemId, variant = 'hydraulics', defaultExpanded = false }: Props) {
  const system = useSystemStore(s => s.systems[systemId])

  const pipes = usePipeCatalogStore(s => s.pipes)
  const coolants = useCoolantCatalogStore(s => s.coolants)

  const summary = useSystemSummary(systemId)

  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showDelete, setShowDelete] = useState(false)

  const counts = useMemo(
    () => (showDelete ? getCascadeDeleteCounts(systemId) : { segments: 0, equipment: 0, ufhLoops: 0 }),
    [showDelete, systemId]
  )

  if (!system) return null

  const schemaLabel = SCHEMA_LABELS[system.schemaType] ?? system.schemaType
  const pipe = pipes[system.pipeMaterialId]
  const pipeLabel = pipe
    ? `${PIPE_MATERIAL_LABELS[pipe.material] ?? pipe.material} DN${pipe.dnMm}`
    : system.pipeMaterialId
  const coolantLabel = coolants[system.coolantId]?.name ?? system.coolantId
  const deltaPDisplay = summary.deltaPKpa != null ? `${summary.deltaPKpa.toFixed(1)} кПа` : '—'
  const pumpDisplay = summary.pumpModel ?? '—'

  const toggle = () => setIsExpanded(v => !v)

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  const handleDeleteConfirm = () => {
    const name = system.name
    cascadeDeleteSystem(systemId)
    setShowDelete(false)
    toast.success(`Система «${name}» удалена`)
  }

  const contentId = `system-${systemId}-content`
  const nameId = `system-${systemId}-name`

  return (
    <section
      className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg)]"
      aria-labelledby={nameId}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-labelledby={nameId}
        onClick={toggle}
        onKeyDown={handleHeaderKeyDown}
        className="flex items-center gap-2 px-3 h-12 cursor-pointer hover:bg-[var(--color-surface)] select-none"
        data-testid="system-header"
      >
        <span
          data-testid="chevron"
          className={`chevron inline-flex transition-transform duration-200 text-[var(--color-text-secondary)] ${
            isExpanded ? 'rotate-90' : ''
          }`}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </span>
        <span id={nameId} className="text-base font-semibold text-[var(--color-text-primary)]">
          {system.name}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)] truncate">
          {' · '}
          {schemaLabel}
          {' · '}
          {pipeLabel}
          {' · '}
          {coolantLabel}
          {' · '}
          {summary.segmentsCount} сегм
          {' · '}
          ΔP_ГЦК {deltaPDisplay}
          {' · '}
          Насос: {pumpDisplay}
        </span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            setShowDelete(true)
          }}
          onKeyDown={e => e.stopPropagation()}
          className="ml-auto p-1 opacity-60 hover:opacity-100 text-[var(--color-destructive)]"
          aria-label={`Удалить систему ${system.name}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      {isExpanded && (
        <div
          id={contentId}
          role="region"
          className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col gap-6"
        >
          <SystemCard system={system} variant={variant} />
          {variant === 'hydraulics' ? (
            <>
              <SegmentTable systemId={systemId} />
              <PumpRecommendation systemId={systemId} />
              <BalancingBlock systemId={systemId} />
            </>
          ) : (
            <div data-testid="ufh-table">
              <UfhTable systemId={systemId} />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        title={`Удалить систему «${system.name}»?`}
        message={
          `Будет удалено: сегментов — ${counts.segments}, приборов — ${counts.equipment}, ` +
          `контуров тёплого пола — ${counts.ufhLoops}. Это действие необратимо.`
        }
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDelete(false)}
      />
    </section>
  )
}
