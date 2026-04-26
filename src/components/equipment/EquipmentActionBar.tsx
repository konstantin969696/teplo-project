/**
 * Equipment action bar — Phase 04.1 upgrade: глобальные tSupply/tReturn удалены.
 * Температуры теперь per-system в SystemCard (D-27). Здесь осталась только
 * кнопка каталога приборов.
 */

import { useState } from 'react'
import { CatalogEditorModal } from './CatalogEditorModal'

export function EquipmentActionBar() {
  const [showCatalog, setShowCatalog] = useState(false)

  return (
    <div className="flex items-center gap-4 flex-wrap p-3 border border-[var(--color-border)] rounded-md bg-[var(--color-surface)]">
      <span className="text-xs text-[var(--color-text-secondary)]">
        Температуры теплоносителя задаются в карточке каждой системы на вкладке «Гидравлика».
      </span>
      <button
        type="button"
        onClick={() => setShowCatalog(true)}
        className="ml-auto px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] text-[var(--color-text-primary)] transition-colors"
        aria-label="Открыть каталог приборов"
      >
        Каталог…
      </button>
      <CatalogEditorModal open={showCatalog} onClose={() => setShowCatalog(false)} />
    </div>
  )
}
