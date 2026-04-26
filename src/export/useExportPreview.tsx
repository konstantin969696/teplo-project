/**
 * Phase 06 — `useExportPreview(builder)` returns a tuple:
 *   [<ExportButton />, <PreviewMaybe />] for use inside any tab.
 *
 * Tabs just render both — clicking the button opens the modal.
 */

import { useState, useCallback } from 'react'
import { Download } from 'lucide-react'
import { PreviewModal } from './preview/PreviewModal'
import type { DocumentModel } from './types'

export function useExportPreview(builder: () => DocumentModel) {
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState<DocumentModel | null>(null)

  const openPreview = useCallback(() => {
    setModel(builder())
    setOpen(true)
  }, [builder])

  const close = useCallback(() => {
    setOpen(false)
    setModel(null)
  }, [])

  const button = (
    <button
      onClick={openPreview}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-sm hover:bg-[var(--color-bg)] transition-colors"
      aria-label="Экспортировать"
    >
      <Download size={14} />
      <span>Экспорт…</span>
    </button>
  )

  const modal = open && model ? <PreviewModal model={model} onClose={close} /> : null

  return { button, modal }
}
