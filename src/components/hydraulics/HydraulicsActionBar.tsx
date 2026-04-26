/**
 * HydraulicsActionBar — каталог-кнопки таба «Гидравлика» (Phase 04.1).
 *
 * Phase 04.1 change: глобальные selects (schemaType/coolantId/pipeMaterialId/tSupply/tReturn)
 * удалены — теперь это per-system параметры в SystemCard. Этот компонент хостит только
 * каталожные кнопки (трубы / КМС / теплоносители).
 */

import { useState } from 'react'
import { Button } from '../ui/Button'
import { PipeCatalogModal } from './PipeCatalogModal'
import { KmsCatalogModal } from './KmsCatalogModal'
import { CoolantCatalogModal } from './CoolantCatalogModal'

export function HydraulicsActionBar() {
  const [showPipeCatalog, setShowPipeCatalog] = useState(false)
  const [showKmsCatalog, setShowKmsCatalog] = useState(false)
  const [showCoolantCatalog, setShowCoolantCatalog] = useState(false)

  return (
    <div className="flex items-center gap-2 p-3 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)]">
      <Button variant="secondary" size="sm" onClick={() => setShowPipeCatalog(true)}>
        Каталог труб…
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setShowKmsCatalog(true)}>
        Каталог КМС…
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setShowCoolantCatalog(true)}>
        Каталог теплоносителей…
      </Button>

      <PipeCatalogModal open={showPipeCatalog} onClose={() => setShowPipeCatalog(false)} />
      <KmsCatalogModal open={showKmsCatalog} onClose={() => setShowKmsCatalog(false)} />
      <CoolantCatalogModal open={showCoolantCatalog} onClose={() => setShowCoolantCatalog(false)} />
    </div>
  )
}
