/**
 * Heat Loss tab orchestrator: action bar + rooms table + results + copy floor modal.
 * Renders below ClimateCard on tab 0.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ActionBar } from './ActionBar'
import { RoomsTable } from './RoomsTable'
import { ResultsTable } from './ResultsTable'
import { CopyFloorModal } from './CopyFloorModal'
import { Button } from '../ui/Button'
import { useProjectStore } from '../../store/projectStore'
import { addRoomsToFloor } from '../room-actions'

export function HeatLossTab() {
  const rooms = useProjectStore(s => s.rooms)
  const roomOrder = useProjectStore(s => s.roomOrder)
  const tOutside = useProjectStore(s => s.city?.tOutside ?? null)
  const [showCopyFloor, setShowCopyFloor] = useState(false)

  const hasRooms = roomOrder.length > 0

  const handleAddFloor = () => {
    const floors = Object.values(rooms).map(r => r.floor)
    const nextFloor = floors.length > 0 ? Math.max(...floors) + 1 : 1
    addRoomsToFloor(nextFloor, 1)
  }

  return (
    <div className="mt-6 space-y-4">
      <ActionBar
        onAddFloor={handleAddFloor}
        onCopyFloor={() => setShowCopyFloor(true)}
        hasRooms={hasRooms}
      />

      {hasRooms ? (
        <>
          <RoomsTable rooms={rooms} roomOrder={roomOrder} tOutside={tOutside} />
          <ResultsTable rooms={rooms} roomOrder={roomOrder} tOutside={tOutside} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            Помещения не добавлены
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Начните с добавления первого помещения
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => addRoomsToFloor(1, 1)}
            icon={<Plus size={14} aria-hidden="true" />}
          >
            Добавить помещение
          </Button>
        </div>
      )}

      <CopyFloorModal
        open={showCopyFloor}
        onClose={() => setShowCopyFloor(false)}
      />
    </div>
  )
}
