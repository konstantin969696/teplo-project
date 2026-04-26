/**
 * SystemCard — inline-edit карточка параметров HeatingSystem (UI-SPEC l.240-256, D-15).
 *
 * Поля: name/sourceLabel/schemaType/pipeMaterialId/coolantId/(tSupply/tReturn)/(tSupplyUfh/tReturnUfh).
 * Actions (footer):
 *   - «+ Добавить сегмент» (primary) — явное ручное добавление нового сегмента через AddSegmentDialog.
 *   - «Удалить систему» (D-04) — cascade delete через ConfirmDialog с real-time counts.
 *
 * Последняя система в проекте: CTA «Удалить» disabled с hint.
 */

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { toast } from 'sonner'
import { useSystemStore, selectOrderedSystems } from '../../store/systemStore'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { AddSegmentDialog } from './AddSegmentDialog'
import {
  cascadeDeleteSystem,
  getCascadeDeleteCounts
} from '../../hooks/cascadeDeleteSystem'
import { INPUT_CLASS, SCHEMA_LABELS, PIPE_MATERIAL_LABELS } from './hydraulics-help'
import type { HeatingSystem } from '../../types/system'
import type { SchemaType } from '../../types/hydraulics'

interface Props {
  readonly system: HeatingSystem
  /** 'hydraulics' (default) — полная карточка. 'ufh' — без радиаторных полей/действий. */
  readonly variant?: 'hydraulics' | 'ufh'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function SystemCard({ system, variant = 'hydraulics' }: Props) {
  const isUfh = variant === 'ufh'
  const orderedSystems = useSystemStore(useShallow(selectOrderedSystems))
  const updateSystem = useSystemStore(s => s.updateSystem)

  const pipes = usePipeCatalogStore(useShallow(s => Object.values(s.pipes)))
  const coolants = useCoolantCatalogStore(useShallow(s => Object.values(s.coolants)))

  const [showDelete, setShowDelete] = useState(false)
  const [showAddSegment, setShowAddSegment] = useState(false)

  const isLastSystem = orderedSystems.length === 1

  // Проверка уникальности имени среди остальных систем.
  const isNameUnique = useMemo(() => {
    return !orderedSystems.some(s => s.id !== system.id && s.name === system.name)
  }, [orderedSystems, system.id, system.name])

  const counts = useMemo(
    () => (showDelete ? getCascadeDeleteCounts(system.id) : { segments: 0, equipment: 0, ufhLoops: 0 }),
    [showDelete, system.id]
  )

  const handleDeleteConfirm = () => {
    const name = system.name
    cascadeDeleteSystem(system.id)
    setShowDelete(false)
    toast.success(`Система «${name}» удалена`)
  }


  return (
    <div
      className="border border-[var(--color-border)] rounded bg-[var(--color-bg)] p-4"
      data-testid="system-card"
    >
      <h4 className="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">
        Параметры системы
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Имя */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-text-secondary)]">Имя</span>
          <input
            type="text"
            value={system.name}
            maxLength={40}
            onChange={e => updateSystem(system.id, { name: e.target.value })}
            className={`${INPUT_CLASS} ${isNameUnique ? '' : 'border-[var(--color-destructive)]'}`}
            aria-label="Имя системы"
            aria-invalid={!isNameUnique}
          />
          {!isNameUnique && (
            <span className="text-[var(--color-destructive)] text-xs">
              Имя уже используется другой системой
            </span>
          )}
        </label>

        {/* Источник тепла */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-text-secondary)]">Источник тепла</span>
          <input
            type="text"
            value={system.sourceLabel}
            onChange={e => updateSystem(system.id, { sourceLabel: e.target.value })}
            className={INPUT_CLASS}
            placeholder="например: Котёл газовый 1"
            aria-label="Источник тепла"
          />
        </label>

        {/* Схема и Трубы — только для радиаторной гидравлики (variant="hydraulics"). */}
        {!isUfh && (
          <>
            {/* Схема */}
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[var(--color-text-secondary)]">Схема</span>
              <select
                value={system.schemaType}
                onChange={e => updateSystem(system.id, { schemaType: e.target.value as SchemaType })}
                className={INPUT_CLASS}
                aria-label="Схема отопления"
              >
                {Object.entries(SCHEMA_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </label>

            {/* Трубы */}
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[var(--color-text-secondary)]">Трубы</span>
              <select
                value={system.pipeMaterialId}
                onChange={e => updateSystem(system.id, { pipeMaterialId: e.target.value })}
                className={INPUT_CLASS}
                aria-label="Тип труб"
              >
                {pipes.map(p => (
                  <option key={p.id} value={p.id}>
                    {`${PIPE_MATERIAL_LABELS[p.material] ?? p.material} DN${p.dnMm}`}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {/* Теплоноситель */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-text-secondary)]">Теплоноситель</span>
          <select
            value={system.coolantId}
            onChange={e => updateSystem(system.id, { coolantId: e.target.value })}
            className={INPUT_CLASS}
            aria-label="Теплоноситель"
          >
            {coolants.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        {/* Радиаторы: tподача / tобратная — только для радиаторной гидравлики. */}
        {!isUfh && (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-text-secondary)]">Радиаторы, °C</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              <span className="text-[var(--color-text-secondary)]">t<sub>подача</sub></span>
              <input
                type="number"
                step={1}
                value={system.tSupply}
                onChange={e => {
                  const v = clamp(parseFloat(e.target.value) || system.tSupply, 40, 95)
                  updateSystem(system.id, { tSupply: v })
                }}
                className={`${INPUT_CLASS} w-16`}
                aria-label="Температура подачи радиаторов, °C"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[var(--color-text-secondary)]">t<sub>обратная</sub></span>
              <input
                type="number"
                step={1}
                value={system.tReturn}
                onChange={e => {
                  const v = clamp(parseFloat(e.target.value) || system.tReturn, 30, 85)
                  updateSystem(system.id, { tReturn: v })
                }}
                className={`${INPUT_CLASS} w-16`}
                aria-label="Температура обратки радиаторов, °C"
              />
            </label>
          </div>
          {system.tSupply <= system.tReturn && (
            <span className="text-[var(--color-destructive)]">
              t<sub>подача</sub> должна быть больше t<sub>обратная</sub>
            </span>
          )}
        </div>
        )}

        {/* Тёплый пол: tподача / tобратная */}
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-text-secondary)]">Тёплый пол, °C</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              <span className="text-[var(--color-text-secondary)]">t<sub>подача</sub></span>
              <input
                type="number"
                step={1}
                value={system.tSupplyUfh}
                onChange={e => {
                  const v = clamp(parseFloat(e.target.value) || system.tSupplyUfh, 25, 55)
                  updateSystem(system.id, { tSupplyUfh: v })
                }}
                className={`${INPUT_CLASS} w-16`}
                aria-label="Температура подачи тёплого пола, °C"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[var(--color-text-secondary)]">t<sub>обратная</sub></span>
              <input
                type="number"
                step={1}
                value={system.tReturnUfh}
                onChange={e => {
                  const v = clamp(parseFloat(e.target.value) || system.tReturnUfh, 20, 50)
                  updateSystem(system.id, { tReturnUfh: v })
                }}
                className={`${INPUT_CLASS} w-16`}
                aria-label="Температура обратки тёплого пола, °C"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        {!isUfh && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowAddSegment(true)}
          >
            Добавить сегмент
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          icon={<Trash2 size={14} />}
          onClick={() => setShowDelete(true)}
          disabled={isLastSystem}
          title={isLastSystem ? 'Проект должен содержать хотя бы одну систему' : undefined}
        >
          Удалить систему
        </Button>
      </div>

      <AddSegmentDialog
        open={showAddSegment}
        systemId={system.id}
        defaultPipeId={system.pipeMaterialId}
        onClose={() => setShowAddSegment(false)}
      />

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
    </div>
  )
}
