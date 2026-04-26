/**
 * Equipment tab orchestrator: action bar (global tSupply/tReturn) + rooms-driven table.
 * Empty state when no rooms — guides user back to heat-loss tab.
 * Granular subscriptions on projectStore keep re-renders cheap.
 */

import { useProjectStore } from '../../store/projectStore'
import { EquipmentActionBar } from './EquipmentActionBar'
import { EquipmentResultsTable } from './EquipmentResultsTable'
import { EquipmentTable } from './EquipmentTable'
import { useExportPreview } from '../../export/useExportPreview'
import { buildEquipmentDocument } from '../../export/content/builders'

export function EquipmentTab() {
  const rooms = useProjectStore(s => s.rooms)
  const roomOrder = useProjectStore(s => s.roomOrder)
  const hasRooms = roomOrder.length > 0
  const exportUI = useExportPreview(buildEquipmentDocument)

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <EquipmentActionBar />
        {hasRooms && exportUI.button}
      </div>
      {exportUI.modal}

      {hasRooms ? (
        <>
          <EquipmentTable rooms={rooms} roomOrder={roomOrder} />
          <EquipmentResultsTable />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            Помещения не добавлены
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Добавьте помещения в табе «Теплопотери», чтобы подобрать приборы
          </p>
        </div>
      )}
    </div>
  )
}
