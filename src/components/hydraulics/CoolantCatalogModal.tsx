/**
 * CoolantCatalogModal — CRUD modal для каталога теплоносителей.
 * Паттерн Phase 3 CatalogEditorModal (P7 shell + Escape + reset-on-open).
 * Вязкость ν отображается в форме как ν·10⁶ (м²/с) для удобства; в store хранится в СИ (м²/с).
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import { INPUT_CLASS } from './hydraulics-help'

interface CoolantCatalogModalProps {
  open: boolean
  onClose: () => void
}

interface CoolantFormState {
  name: string
  rhoKgM3: string
  cKjKgK: string
  nuMicro: string   // ν × 10⁶ в форме (для читаемости)
}

const EMPTY_FORM: CoolantFormState = { name: '', rhoKgM3: '', cKjKgK: '', nuMicro: '' }

function validateCoolantForm(form: CoolantFormState): boolean {
  const rho = parseFloat(form.rhoKgM3)
  const c = parseFloat(form.cKjKgK)
  const nuMicro = parseFloat(form.nuMicro)
  // nuMicro = ν × 10⁶; ν диапазон [1e-8..1e-4] → nuMicro [0.01..100]
  return (
    form.name.trim().length > 0 &&
    Number.isFinite(rho) && rho >= 500 && rho <= 1500 &&
    Number.isFinite(c) && c >= 1 && c <= 10 &&
    Number.isFinite(nuMicro) && nuMicro >= 0.01 && nuMicro <= 100
  )
}

export function CoolantCatalogModal({ open, onClose }: CoolantCatalogModalProps) {
  const coolants = useCoolantCatalogStore(s => s.coolants)
  const addCoolant = useCoolantCatalogStore(s => s.addCoolant)
  const updateCoolant = useCoolantCatalogStore(s => s.updateCoolant)
  const deleteCoolant = useCoolantCatalogStore(s => s.deleteCoolant)
  const resetToSeed = useCoolantCatalogStore(s => s.resetToSeed)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CoolantFormState>(EMPTY_FORM)

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

  const isFormValid = validateCoolantForm(form)
  const coolantList = Object.values(coolants)

  const handleSave = () => {
    if (!isFormValid) return
    const payload = {
      name: form.name.trim(),
      rhoKgM3: parseFloat(form.rhoKgM3),
      cKjKgK: parseFloat(form.cKjKgK),
      nuM2S: parseFloat(form.nuMicro) / 1e6,  // конвертация ν·10⁶ → м²/с
    }
    if (editingId !== null) {
      updateCoolant(editingId, payload)
      toast.success('Теплоноситель обновлён')
    } else {
      addCoolant(payload)
      toast.success('Теплоноситель добавлен')
    }
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleDelete = (id: string) => {
    deleteCoolant(id)
    if (editingId === id) { setEditingId(null); setForm(EMPTY_FORM) }
    toast.success('Теплоноситель удалён')
  }

  const handleReset = () => {
    if (!window.confirm('Сбросить каталог теплоносителей к умолчаниям? Все правки будут удалены.')) return
    resetToSeed()
    setEditingId(null)
    setForm(EMPTY_FORM)
    toast.success('Каталог теплоносителей сброшен')
  }

  const handleRowClick = (id: string) => {
    const c = coolants[id]
    if (!c) return
    setEditingId(id)
    setForm({
      name: c.name,
      rhoKgM3: String(c.rhoKgM3),
      cKjKgK: String(c.cKjKgK),
      nuMicro: (c.nuM2S * 1e6).toFixed(4),  // м²/с → ν·10⁶
    })
  }

  const f = (field: keyof CoolantFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
         onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="coolant-catalog-title">
      <div className="max-w-[580px] w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6 max-h-[90vh] overflow-hidden flex flex-col"
           onClick={e => e.stopPropagation()}>
        <h3 id="coolant-catalog-title" className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
          Каталог теплоносителей
        </h3>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Left: list */}
          <div className="w-48 flex-shrink-0 overflow-y-auto border border-[var(--color-border)] rounded">
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}
              className="w-full text-left px-2 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              + Новый теплоноситель
            </button>
            {coolantList.map(c => (
              <div key={c.id} onClick={() => handleRowClick(c.id)}
                className={`flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer hover:bg-[var(--color-surface)] ${editingId === c.id ? 'bg-[var(--color-surface)] font-semibold' : ''}`}>
                <span>{c.name}</span>
                <button type="button" onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
                  className="text-[var(--color-destructive)] ml-1 text-xs" aria-label="Удалить">✕</button>
              </div>
            ))}
          </div>

          {/* Right: form */}
          <div className="flex-1 overflow-y-auto space-y-3">
            <label className="flex flex-col gap-1 text-xs">
              Название
              <input type="text" value={form.name} onChange={f('name')} className={INPUT_CLASS} placeholder="Вода" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Плотность ρ, кг/м³ (500..1500)
              <input type="number" value={form.rhoKgM3} onChange={f('rhoKgM3')} className={INPUT_CLASS} placeholder="987" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Теплоёмкость c, кДж/(кг·К) (1..10)
              <input type="number" step="0.01" value={form.cKjKgK} onChange={f('cKjKgK')} className={INPUT_CLASS} placeholder="4.18" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Вязкость ν·10⁶, м²/с (0.01..100)
              <input type="number" step="0.001" value={form.nuMicro} onChange={f('nuMicro')} className={INPUT_CLASS} placeholder="0.55" />
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
