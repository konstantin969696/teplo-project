/**
 * HydraulicsTab — orchestrator таба «Гидравлика» (Phase 04.1).
 * Рендерит каталог-бар + SystemList с аккордеоном-систем.
 */

import { HydraulicsActionBar } from './HydraulicsActionBar'
import { SystemList } from './SystemList'

export function HydraulicsTab() {
  return (
    <div className="mt-6 space-y-4">
      <HydraulicsActionBar />
      <SystemList variant="hydraulics" />
    </div>
  )
}
