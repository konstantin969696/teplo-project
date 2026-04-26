/**
 * HydraulicsTab — orchestrator таба «Гидравлика» (Phase 04.1).
 * Рендерит каталог-бар + SystemList с аккордеоном-систем.
 * Phase 06: + кнопка «Экспорт…» с per-document preview.
 */

import { HydraulicsActionBar } from './HydraulicsActionBar'
import { SystemList } from './SystemList'
import { useExportPreview } from '../../export/useExportPreview'
import { buildHydraulicsDocument } from '../../export/content/builders'

export function HydraulicsTab() {
  const exportUI = useExportPreview(buildHydraulicsDocument)
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <HydraulicsActionBar />
        {exportUI.button}
      </div>
      {exportUI.modal}
      <SystemList variant="hydraulics" />
    </div>
  )
}
