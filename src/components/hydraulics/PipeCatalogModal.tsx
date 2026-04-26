/**
 * PipeCatalogModal — CRUD modal для каталога труб.
 * Паттерн Phase 3 CatalogEditorModal (P7 shell + Escape + reset-on-open).
 * Хранит список слева, форму справа.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import { INPUT_CLASS, PIPE_MATERIAL_LABELS } from './hydraulics-help'
import type { PipeMaterial } from '../../types/hydraulics'

interface PipeCatalogModalProps {
  open: boolean
  onClose: () => void
}

interface PipeFormState {
  material: PipeMaterial
  dnMm: string
  innerDiameterMm: string
  roughnessMm: string
  wallThicknessMm: string
  maxLoopLengthM: string
}

const EMPTY_FORM: PipeFormState = {
  material: 'steel-vgp',
  dnMm: '',
  innerDiameterMm: '',
  roughnessMm: '0.2',
  wallThicknessMm: '',
  maxLoopLengthM: '',
}

const PIPE_MATERIALS: PipeMaterial[] = ['steel-vgp', 'copper', 'pe-x', 'pe-rt', 'mlcp', 'ppr']

function validatePipeForm(form: PipeFormState): boolean {
  const dn = parseFloat(form.dnMm)
  const inner = parseFloat(form.innerDiameterMm)
  const rough = parseFloat(form.roughnessMm)
  const wall = parseFloat(form.wallThicknessMm)
  return (
    PIPE_MATERIALS.includes(form.material) &&
    Number.isFinite(dn) && dn > 0 &&
    Number.isFinite(inner) && inner > 0 &&
    Number.isFinite(rough) && rough >= 0 &&
    Number.isFinite(wall) && wall > 0
  )
}

export function PipeCatalogModal({ open, onClose }: PipeCatalogModalProps) {
  const pipes = usePipeCatalogStore(s => s.pipes)
  const addPipe = usePipeCatalogStore(s => s.addPipe)
  const updatePipe = usePipeCatalogStore(s => s.updatePipe)
  const deletePipe = usePipeCatalogStore(s => s.deletePipe)
  const resetToSeed = usePipeCatalogStore(s => s.resetToSeed)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PipeFormState>(EMPTY_FORM)

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

  const isFormValid = validatePipeForm(form)
  const pipeList = Object.values(pipes)

  const handleSave = () => {
    if (!isFormValid) return
    const payload = {
      material: form.material,
      dnMm: parseFloat(form.dnMm),
      innerDiameterMm: parseFloat(form.innerDiameterMm),
      roughnessMm: parseFloat(form.roughnessMm),
      wallThicknessMm: parseFloat(form.wallThicknessMm),
      maxLoopLengthM: form.maxLoopLengthM.trim() ? parseFloat(form.maxLoopLengthM) : null,
    }
    if (editingId !== null) {
      updatePipe(editingId, payload)
      toast.success('Труба обновлена')
    } else {
      addPipe(payload)
      toast.success('Труба добавлена')
    }
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleDelete = (id: string) => {
    deletePipe(id)
    if (editingId === id) { setEditingId(null); setForm(EMPTY_FORM) }
    toast.success('Труба удалена')
  }

  const handleReset = () => {
    if (!window.confirm('Сбросить каталог труб к умолчаниям? Все правки будут удалены.')) return
    resetToSeed()
    setEditingId(null)
    setForm(EMPTY_FORM)
    toast.success('Каталог труб сброшен')
  }

  const handleRowClick = (id: string) => {
    const p = pipes[id]
    if (!p) return
    setEditingId(id)
    setForm({
      material: p.material,
      dnMm: String(p.dnMm),
      innerDiameterMm: String(p.innerDiameterMm),
      roughnessMm: String(p.roughnessMm),
      wallThicknessMm: String(p.wallThicknessMm),
      maxLoopLengthM: p.maxLoopLengthM !== null ? String(p.maxLoopLengthM) : '',
    })
  }

  const f = (field: keyof PipeFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
         onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="pipe-catalog-title">
      <div className="max-w-[760px] w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6 max-h-[90vh] overflow-hidden flex flex-col"
           onClick={e => e.stopPropagation()}>
        <h3 id="pipe-catalog-title" className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
          Каталог труб
        </h3>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Left: list */}
          <div className="w-56 flex-shrink-0 overflow-y-auto border border-[var(--color-border)] rounded">
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}
              className="w-full text-left px-2 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              + Новая труба
            </button>
            {pipeList.map(p => (
              <div key={p.id} onClick={() => handleRowClick(p.id)}
                className={`flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer hover:bg-[var(--color-surface)] ${editingId === p.id ? 'bg-[var(--color-surface)] font-semibold' : ''}`}>
                <span>{PIPE_MATERIAL_LABELS[p.material] ?? p.material} {p.dnMm} — {p.innerDiameterMm} мм</span>
                <button type="button" onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                  className="text-[var(--color-destructive)] ml-1 text-xs" aria-label="Удалить">✕</button>
              </div>
            ))}
          </div>

          {/* Right: form */}
          <div className="flex-1 overflow-y-auto space-y-3">
            <label className="flex flex-col gap-1 text-xs">
              Материал
              <select value={form.material} onChange={f('material')} className={INPUT_CLASS}>
                {PIPE_MATERIALS.map(m => <option key={m} value={m}>{PIPE_MATERIAL_LABELS[m]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              DN (номинальный диаметр, мм)
              <input type="number" value={form.dnMm} onChange={f('dnMm')} className={INPUT_CLASS} placeholder="20" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Внутренний диаметр, мм
              <input type="number" value={form.innerDiameterMm} onChange={f('innerDiameterMm')} className={INPUT_CLASS} placeholder="21.2" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Шероховатость Δ, мм
              <input type="number" step="0.01" value={form.roughnessMm} onChange={f('roughnessMm')} className={INPUT_CLASS} placeholder="0.2" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Толщина стенки, мм
              <input type="number" step="0.1" value={form.wallThicknessMm} onChange={f('wallThicknessMm')} className={INPUT_CLASS} placeholder="2.8" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Макс. длина контура UFH, м (опц.)
              <input type="number" value={form.maxLoopLengthM} onChange={f('maxLoopLengthM')} className={INPUT_CLASS} placeholder="120" />
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
