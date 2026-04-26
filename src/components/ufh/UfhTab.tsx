/**
 * UFH tab orchestrator — Phase 04.1 Plan 06.
 *
 * Per-system архитектура (D-17): корневой таб рендерит SystemList variant='ufh',
 * который для каждой системы даёт SystemAccordion с UfhTable внутри.
 * Глобальный UfhActionBar убран — tSupplyUfh/tReturnUfh переехали в SystemCard.
 */

import { SystemList } from '../hydraulics/SystemList'

export function UfhTab() {
  return (
    <div className="p-4">
      <SystemList variant="ufh" />
    </div>
  )
}
