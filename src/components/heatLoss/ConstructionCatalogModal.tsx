/**
 * Construction catalog editor — add/edit/delete pre-built enclosure "pies".
 *
 * Simpler than CatalogEditorModal (equipment) because the Construction schema
 * has no variants — just { name, type, category, kValue, note }.
 *
 * Layout: left pane — searchable list grouped by EnclosureType; right pane —
 * form for the selected / new entry. Modal closes on Esc / overlay click.
 */

import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import type { CatalogConstruction, EnclosureType } from '../../types/project'
import { useConstructionStore } from '../../store/constructionStore'
import { ENCLOSURE_TYPE_CONFIG } from '../../engine/heatLoss'

interface ConstructionCatalogModalProps {
  open: boolean
  onClose: () => void
}

const ENCLOSURE_TYPES: EnclosureType[] = [
  'wall-ext', 'window', 'door-ext', 'ceiling', 'roof',
  'floor-ground', 'wall-int', 'ceiling-int',
]

const inputClass =
  'border border-[var(--color-border)] rounded px-2 py-1 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors w-full'

interface FormState {
  name: string
  type: EnclosureType
  kValue: string
  category: string
  note: string
}

const emptyForm: FormState = { name: '', type: 'wall-ext', kValue: '', category: '', note: '' }

function toForm(c: CatalogConstruction): FormState {
  return {
    name: c.name,
    type: c.type,
    kValue: String(c.kValue),
    category: c.category ?? '',
    note: c.note ?? '',
  }
}

function validateForm(form: FormState): string | null {
  if (!form.name.trim()) return 'Название не может быть пустым.'
  const k = parseFloat(form.kValue)
  if (!Number.isFinite(k) || k < 0) return 'K должно быть ≥ 0.'
  if (k > 20) return 'K слишком велико (> 20). Проверь ввод.'
  return null
}

export function ConstructionCatalogModal({ open, onClose }: ConstructionCatalogModalProps) {
  const all = useConstructionStore(
    useShallow(s => Object.values(s.models))
  )
  const addConstruction = useConstructionStore(s => s.addConstruction)
  const updateConstruction = useConstructionStore(s => s.updateConstruction)
  const deleteConstruction = useConstructionStore(s => s.deleteConstruction)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [filterType, setFilterType] = useState<EnclosureType | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setForm(emptyForm)
      setSearch('')
      setFilterType('all')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return all
      .filter(c => filterType === 'all' || c.type === filterType)
      .filter(c => !s || c.name.toLowerCase().includes(s) || (c.category ?? '').toLowerCase().includes(s))
      .sort((a, b) => {
        if (a.type !== b.type) return ENCLOSURE_TYPES.indexOf(a.type) - ENCLOSURE_TYPES.indexOf(b.type)
        const ac = a.category ?? 'яяя'
        const bc = b.category ?? 'яяя'
        if (ac !== bc) return ac.localeCompare(bc, 'ru')
        return a.name.localeCompare(b.name, 'ru')
      })
  }, [all, filterType, search])

  const selected = selectedId ? all.find(c => c.id === selectedId) ?? null : null

  const handleSelect = (c: CatalogConstruction) => {
    setSelectedId(c.id)
    setForm(toForm(c))
  }

  const handleNew = () => {
    setSelectedId(null)
    setForm({ ...emptyForm, type: filterType === 'all' ? 'wall-ext' : filterType })
  }

  const handleSave = () => {
    const err = validateForm(form)
    if (err) { toast.error(err); return }
    const k = parseFloat(form.kValue)
    const payload = {
      name: form.name.trim(),
      type: form.type,
      kValue: k,
      category: form.category.trim() || null,
      note: form.note.trim() || null,
    }
    if (selectedId) {
      updateConstruction(selectedId, payload)
      toast.success('Конструкция обновлена')
    } else {
      const newId = addConstruction(payload)
      setSelectedId(newId)
      toast.success('Конструкция добавлена в каталог')
    }
  }

  const handleDelete = () => {
    if (!selected) return
    if (!confirm(`Удалить «${selected.name}»?`)) return
    deleteConstruction(selected.id)
    setSelectedId(null)
    setForm(emptyForm)
    toast.success('Конструкция удалена')
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Каталог конструкций"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Каталог конструкций</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Готовые «пироги» ограждений с посчитанным K</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Закрыть"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body: list + form */}
        <div className="flex-1 flex min-h-0">
          {/* LIST pane */}
          <div className="w-[340px] border-r border-[var(--color-border)] flex flex-col min-h-0">
            <div className="p-2 flex flex-col gap-2 border-b border-[var(--color-border)]">
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as EnclosureType | 'all')}
                  className={`${inputClass} flex-1`}
                  aria-label="Фильтр по типу"
                >
                  <option value="all">Все типы</option>
                  {ENCLOSURE_TYPES.map(t => (
                    <option key={t} value={t}>{ENCLOSURE_TYPE_CONFIG[t].label}</option>
                  ))}
                </select>
                <button
                  onClick={handleNew}
                  className="px-2 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90 inline-flex items-center gap-1"
                  aria-label="Добавить новую"
                  title="Добавить новую"
                >
                  <Plus size={12} aria-hidden="true" />
                  Новая
                </button>
              </div>
              <input
                type="search"
                placeholder="Поиск по имени или категории"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={inputClass}
                aria-label="Поиск конструкций"
              />
            </div>
            <ul className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-sm text-[var(--color-text-secondary)]">Ничего не найдено</li>
              )}
              {filtered.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => handleSelect(c)}
                    className={`w-full text-left px-3 py-2 hover:bg-[var(--color-surface)] border-l-2 ${
                      selectedId === c.id ? 'border-[var(--color-accent)] bg-[var(--color-surface)]' : 'border-transparent'
                    }`}
                  >
                    <div className="text-sm text-[var(--color-text-primary)] flex items-center gap-1">
                      <span className="truncate">{c.name}</span>
                      {c.isCustom && (
                        <span className="text-[10px] text-[var(--color-accent)] font-mono">(польз.)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-2">
                      <span>{ENCLOSURE_TYPE_CONFIG[c.type].label}</span>
                      {c.category && <span>· {c.category}</span>}
                      <span className="font-mono ml-auto">K={c.kValue.toFixed(2)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* FORM pane */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-sm text-[var(--color-text-secondary)] mb-2">
                {selected ? `Редактирование · ${selected.isCustom ? 'пользовательская' : 'встроенная'}` : 'Новая конструкция'}
              </div>

              <label className="block">
                <span className="text-xs text-[var(--color-text-secondary)]">Название *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="например: Кирпич 510 + ЭППС 100"
                  maxLength={120}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-[var(--color-text-secondary)]">Тип ограждения *</span>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as EnclosureType })}
                    className={inputClass}
                  >
                    {ENCLOSURE_TYPES.map(t => (
                      <option key={t} value={t}>{ENCLOSURE_TYPE_CONFIG[t].label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-[var(--color-text-secondary)]">K Вт/(м²·°C) *</span>
                  <input
                    type="number"
                    value={form.kValue}
                    onChange={e => setForm({ ...form, kValue: e.target.value })}
                    min={0}
                    max={20}
                    step={0.01}
                    className={`${inputClass} font-mono`}
                    placeholder="0.00"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-[var(--color-text-secondary)]">Категория (подгруппа)</span>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                  placeholder="например: Кирпичные, Окна (СПК)"
                  maxLength={60}
                />
              </label>

              <label className="block">
                <span className="text-xs text-[var(--color-text-secondary)]">Примечание (состав / источник / где подходит)</span>
                <textarea
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  className={`${inputClass} resize-y min-h-[80px]`}
                  rows={3}
                  maxLength={400}
                  placeholder="Например: Керамический кирпич 510 + ЭППС λ=0.032 δ=100 мм + штукатурка. R ≈ 3.4 м²·°C/Вт."
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between p-3 border-t border-[var(--color-border)] gap-2">
              {selected ? (
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-destructive)] hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  aria-label="Удалить"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Удалить
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-[var(--color-text-primary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)]"
                >
                  Закрыть
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded hover:opacity-90"
                >
                  {selected ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
