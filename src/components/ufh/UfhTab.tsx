/**
 * UFH tab orchestrator — Phase 04.1 Plan 06.
 *
 * Per-system архитектура (D-17): корневой таб рендерит SystemList variant='ufh',
 * который для каждой системы даёт SystemAccordion с UfhTable внутри.
 * Глобальный UfhActionBar убран — tSupplyUfh/tReturnUfh переехали в SystemCard.
 *
 * Phase 06: + кнопка «Экспорт…» с per-document preview.
 */

import { SystemList } from '../hydraulics/SystemList'
import { useExportPreview } from '../../export/useExportPreview'
import { buildUfhDocument } from '../../export/content/builders'

export function UfhTab() {
  const exportUI = useExportPreview(buildUfhDocument)
  return (
    <div className="p-4">
      <div className="flex justify-end mb-3">{exportUI.button}</div>
      {exportUI.modal}
      <SystemList variant="ufh" />
    </div>
  )
}
