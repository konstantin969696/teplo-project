/**
 * UFH table — one row per room which has a UFH loop in this system.
 * Per-system (D-17): filter loops by systemId.
 *
 * Row set = rooms, имеющие loop.systemId === systemId. Добавлены helper'ы
 * чтобы инженер мог создать новый loop прямо из этой таблицы (+ "Добавить контур").
 * При пустом наборе — inline empty state с CTA.
 */

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Thermometer } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import { UfhLoopRow } from './UfhLoopRow'
import { ColumnHint } from '../ColumnHint'
import { UFH_HINTS } from '../hydraulics/glossary'
import { Button } from '../ui/Button'

interface UfhTableProps {
  readonly systemId: string
}

export function UfhTable({ systemId }: UfhTableProps) {
  const roomOrder = useProjectStore(s => s.roomOrder)
  const rooms = useProjectStore(s => s.rooms)

  // Собираем loops текущей системы — один raw источник истины.
  const systemLoops = useUfhLoopStore(
    useShallow(s =>
      Object.values(s.loops).filter(l => l.systemId === systemId)
    )
  )
  const addLoop = useUfhLoopStore(s => s.addLoop)

  const pipes = usePipeCatalogStore(
    useShallow(s => Object.values(s.pipes).filter(p => p.maxLoopLengthM !== null))
  )

  // Rooms с loop'ом в этой системе.
  const roomIdsWithLoop = useMemo(
    () => new Set(systemLoops.map(l => l.roomId)),
    [systemLoops]
  )
  const systemRoomOrder = useMemo(
    () => roomOrder.filter(rid => roomIdsWithLoop.has(rid)),
    [roomOrder, roomIdsWithLoop]
  )

  // Rooms которые пока не имеют loop (для выбора при "+ Добавить контур").
  // Берём первую свободную — если нет, кнопку всё равно показываем (создастся loop для первой комнаты).
  const handleAddLoop = () => {
    const firstFreeRoomId =
      roomOrder.find(rid => !roomIdsWithLoop.has(rid)) ?? roomOrder[0]
    if (!firstFreeRoomId) return
    const defaultPipeId = pipes[0]?.id ?? ''
    const room = rooms[firstFreeRoomId]
    const defaultArea = room ? Math.max(1, Math.round(room.area * 0.8 * 10) / 10) : 1
    addLoop({
      roomId: firstFreeRoomId,
      systemId,
      enabled: true,
      activeAreaM2: defaultArea,
      covering: 'tile',
      pipeId: defaultPipeId,
      stepCm: 20,
      leadInM: 3,
    })
  }

  if (systemRoomOrder.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 border border-dashed border-[var(--color-border)] rounded-md">
        <Thermometer size={32} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-secondary)] text-center">
          В этой системе нет контуров тёплого пола
        </p>
        {roomOrder.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={handleAddLoop}
          >
            Добавить контур
          </Button>
        )}
        {roomOrder.length === 0 && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            Сначала добавьте помещения в табе «Теплопотери»
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="h-8 text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
            <th className="w-6 px-2"></th>
            <th className="text-left px-2">Помещение</th>
            <th className="w-20 text-right px-2"><ColumnHint label="F_тп, м²" hint={UFH_HINTS.F_tp} /></th>
            <th className="w-28 text-left px-2"><ColumnHint label="Покрытие" hint={UFH_HINTS.covering} /></th>
            <th className="w-28 text-left px-2"><ColumnHint label="Труба ТП" hint={UFH_HINTS.pipe} /></th>
            <th className="w-16 text-right px-2"><ColumnHint label="Шаг, см" hint={UFH_HINTS.step} /></th>
            <th className="w-20 text-right px-2"><ColumnHint label="q, Вт/м²" hint={UFH_HINTS.q_per_m2} /></th>
            <th className="w-6 text-center px-2" title="Предупреждения: нарушение норм t_пола или недостаточная мощность петли">!</th>
          </tr>
        </thead>
        <tbody>
          {systemRoomOrder.map((roomId, index) => {
            const room = rooms[roomId]
            if (!room) return null
            return <UfhLoopRow key={roomId} room={room} index={index} />
          })}
        </tbody>
      </table>
      <div className="mt-3 flex justify-start">
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={handleAddLoop}
        >
          Добавить контур
        </Button>
      </div>
    </div>
  )
}
