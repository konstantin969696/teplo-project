/**
 * KmsCatalogModal — CRUD modal для справочника КМС (местных сопротивлений).
 * Паттерн Phase 3 CatalogEditorModal (P7 shell + Escape + reset-on-open).
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useKmsCatalogStore } from '../../store/kmsCatalogStore'
import { INPUT_CLASS } from './hydraulics-help'

interface KmsCatalogModalProps {
  open: boolean
  onClose: () => void
}

interface KmsFormState {
  name: string
  zeta: string
}

const EMPTY_FORM: KmsFormState = { name: '', zeta: '' }

function validateKmsForm(form: KmsFormState): boolean {
  const zeta = parseFloat(form.zeta)
  return (
    form.name.trim().length > 0 &&
    Number.isFinite(zeta) && zeta >= 0 && zeta <= 20
  )
}

export function KmsCatalogModal({ open, onClose }: KmsCatalogModalProps) {
  const elements = useKmsCatalogStore(s => s.elements)
  const addKms = useKmsCatalogStore(s => s.addKms)
  const updateKms = useKmsCatalogStore(s => s.updateKms)
  const deleteKms = useKmsCatalogStore(s => s.deleteKms)
  const resetToSeed = useKmsCatalogStore(s => s.resetToSeed)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<KmsFormState>(EMPTY_FORM)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setEditingId(null)
      setForm(EMPTY_FORM)
    }
  }, [open])

  if (!open) return null

  const isFormValid = validateKmsForm(form)
  const kmsList = Object.values(elements)

  const handleSave = () => {
    if (!isFormValid) return
    const payload = { name: form.name.trim(), zeta: parseFloat(form.zeta) }
    if (editingId !== null) {
      updateKms(editingId, payload)
      toast.success('КМС обновлён')
    } else {
      addKms(payload)
      toast.success('КМС добавлен')
    }
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleDelete = (id: string) => {
    deleteKms(id)
    if (editingId === id) { setEditingId(null); setForm(EMPTY_FORM) }
    toast.success('КМС удалён')
  }

  const handleReset = () => {
    if (!window.confirm('Сбросить справочник КМС к умолчаниям? Все правки будут удалены.')) return
    resetToSeed()
    setEditingId(null)
    setForm(EMPTY_FORM)
    toast.success('Справочник КМС сброшен')
  }

  const handleRowClick = (id: string) => {
    const k = elements[id]
    if (!k) return
    setEditingId(id)
    setForm({ name: k.name, zeta: String(k.zeta) })
  }

  const f = (field: keyof KmsFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
         onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="kms-catalog-title">
      <div className="max-w-[580px] w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6 max-h-[90vh] overflow-hidden flex flex-col"
           onClick={e => e.stopPropagation()}>
        <h3 id="kms-catalog-title" className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
          Справочник КМС
        </h3>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Left: list */}
          <div className="w-56 flex-shrink-0 overflow-y-auto border border-[var(--color-border)] rounded">
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}
              className="w-full text-left px-2 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              + Новый КМС
            </button>
            {kmsList.map(k => (
              <div key={k.id} onClick={() => handleRowClick(k.id)}
                className={`flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer hover:bg-[var(--color-surface)] ${editingId === k.id ? 'bg-[var(--color-surface)] font-semibold' : ''}`}>
                <span>{k.name} (ζ={k.zeta.toFixed(2)})</span>
                <button type="button" onClick={e => { e.stopPropagation(); handleDelete(k.id) }}
                  className="text-[var(--color-destructive)] ml-1 text-xs" aria-label="Удалить">✕</button>
              </div>
            ))}
          </div>

          {/* Right: form */}
          <div className="flex-1 overflow-y-auto space-y-3">
            <label className="flex flex-col gap-1 text-xs">
              Название КМС
              <input type="text" value={form.name} onChange={f('name')} className={INPUT_CLASS} placeholder="Колено 90°" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Коэффициент ζ (0..20)
              <input type="number" step="0.01" min="0" max="20" value={form.zeta} onChange={f('zeta')} className={INPUT_CLASS} placeholder="1.5" />
            </label>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--color-border)]">
          <button type="button" onClick={handleReset}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)]">
            Сбросить к умолчанию
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={!isFormValid}
              className={`px-3 py-1.5 text-sm rounded ${isFormValid ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] cursor-not-allowed'}`}>
              {editingId !== null ? 'Обновить' : 'Добавить'}
            </button>
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] text-[var(--color-text-primary)]">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
