/**
 * UFH table — one row per room which has a UFH loop in this system.
 * Per-system (D-17): filter loops by systemId.
 *
 * Row set = rooms, имеющие loop.systemId === systemId. Добавлены helper'ы
 * чтобы инженер мог создать новый loop прямо из этой таблицы (+ "Добавить контур").
 * При пустом наборе — inline empty state с CTA.
 * При нескольких свободных помещениях — диалог выбора перед созданием контура.
 */

import { useMemo, useState } from 'react'
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

// ---------------------------------------------------------------------------
// Room-picker dialog
// ---------------------------------------------------------------------------

interface RoomPickerDialogProps {
  open: boolean
  rooms: Array<{ id: string; name: string; floor: number }>
  onConfirm: (roomId: string) => void
  onCancel: () => void
}

function RoomPickerDialog({ open, rooms, onConfirm, onCancel }: RoomPickerDialogProps) {
  const [selectedId, setSelectedId] = useState(rooms[0]?.id ?? '')

  // Sync default when rooms list changes
  useMemo(() => {
    if (rooms.length > 0) setSelectedId(rooms[0].id)
  }, [rooms])

  if (!open || rooms.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Выбор помещения для контура"
      data-testid="room-picker-dialog"
    >
      <div
        className="max-w-xs w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Выберите помещение
        </h3>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          data-testid="room-picker-select"
          autoFocus
        >
          {rooms.map(r => (
            <option key={r.id} value={r.id}>
              {r.name} (эт. {r.floor})
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedId)}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
            data-testid="room-picker-confirm"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UfhTable
// ---------------------------------------------------------------------------

export function UfhTable({ systemId }: UfhTableProps) {
  const roomOrder = useProjectStore(s => s.roomOrder)
  const rooms = useProjectStore(s => s.rooms)

  const systemLoops = useUfhLoopStore(
    useShallow(s =>
      Object.values(s.loops).filter(l => l.systemId === systemId)
    )
  )
  const loopsByRoom = useUfhLoopStore(s => s.loopsByRoom)
  const addLoop = useUfhLoopStore(s => s.addLoop)

  const pipes = usePipeCatalogStore(
    useShallow(s => Object.values(s.pipes).filter(p => p.maxLoopLengthM !== null))
  )

  const roomIdsWithLoop = useMemo(
    () => new Set(systemLoops.map(l => l.roomId)),
    [systemLoops]
  )
  const systemRoomOrder = useMemo(
    () => roomOrder.filter(rid => roomIdsWithLoop.has(rid)),
    [roomOrder, roomIdsWithLoop]
  )

  // Free rooms = rooms without any loop globally (not just this system).
  const freeRooms = useMemo(
    () => roomOrder
      .filter(rid => !loopsByRoom[rid])
      .map(rid => rooms[rid])
      .filter(Boolean) as Array<{ id: string; name: string; floor: number; area: number }>,
    [roomOrder, loopsByRoom, rooms]
  )

  const [pickerOpen, setPickerOpen] = useState(false)

  const doAddLoop = (roomId: string) => {
    const defaultPipeId = pipes[0]?.id ?? ''
    const room = rooms[roomId]
    const defaultArea = room ? Math.max(1, Math.round(room.area * 0.8 * 10) / 10) : 1
    addLoop({
      roomId,
      systemId,
      enabled: true,
      activeAreaM2: defaultArea,
      covering: 'tile',
      pipeId: defaultPipeId,
      stepCm: 20,
      leadInM: 3,
    })
  }

  const handleAddLoop = () => {
    if (freeRooms.length === 0) return
    if (freeRooms.length === 1) {
      doAddLoop(freeRooms[0].id)
    } else {
      setPickerOpen(true)
    }
  }

  const handlePickerConfirm = (roomId: string) => {
    doAddLoop(roomId)
    setPickerOpen(false)
  }

  const canAddMore = freeRooms.length > 0

  if (systemRoomOrder.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-3 p-6 border border-dashed border-[var(--color-border)] rounded-md">
          <Thermometer size={32} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            В этой системе нет контуров тёплого пола
          </p>
          {roomOrder.length > 0 && canAddMore && (
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
          {roomOrder.length > 0 && !canAddMore && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Все помещения уже имеют контур тёплого пола
            </p>
          )}
        </div>
        <RoomPickerDialog
          open={pickerOpen}
          rooms={freeRooms}
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerOpen(false)}
        />
      </>
    )
  }

  return (
    <>
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
        {canAddMore && (
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
        )}
      </div>
      <RoomPickerDialog
        open={pickerOpen}
        rooms={freeRooms}
        onConfirm={handlePickerConfirm}
        onCancel={() => setPickerOpen(false)}
      />
    </>
  )
}
