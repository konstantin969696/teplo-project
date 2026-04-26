/**
 * Catalog CRUD modal — D-01 editable equipment catalog.
 * Оркестратор: тело + футер + state-management. Сам список и форма — в
 * CatalogModelList.tsx и CatalogModelForm.tsx (чтобы держать файл < 500 строк).
 *
 * BLOCKER-4: populateFormFromModel copies all fields from clicked model into form state.
 * Без этого "Обновить" без правок затёр бы модель EMPTY_FORM-значениями.
 *
 * Validation (T-3-01 mirror): qPerSectionAt70 > 0, nExponent ∈ [1.0..2.0],
 * maxSections integer [1..30], dimensions > 0, panel/convector variants — valid JSON.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { CatalogModel, EquipmentKind } from '../../types/project'
import { useCatalogStore } from '../../store/catalogStore'
import { CatalogModelList } from './CatalogModelList'
import { CatalogModelForm } from './CatalogModelForm'
import {
  EMPTY_FORM,
  buildPayload,
  populateFormFromModel,
  validateForm,
  type FormState,
} from './catalog-editor-helpers'

interface CatalogEditorModalProps {
  open: boolean
  onClose: () => void
}

export function CatalogEditorModal({ open, onClose }: CatalogEditorModalProps) {
  const models = useCatalogStore(s => s.models)
  const addModel = useCatalogStore(s => s.addModel)
  const updateModel = useCatalogStore(s => s.updateModel)
  const deleteModel = useCatalogStore(s => s.deleteModel)
  const resetToSeed = useCatalogStore(s => s.resetToSeed)

  const [filter, setFilter] = useState<EquipmentKind | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  // Escape closes modal
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset state when modal (re)opens
  useEffect(() => {
    if (open) {
      setEditingId(null)
      setForm(EMPTY_FORM)
      setFilter('all')
    }
  }, [open])

  if (!open) return null

  const filteredModels = Object.values(models).filter(
    m => filter === 'all' || m.kind === filter,
  )
  const isFormValid = validateForm(form)

  const handleSave = () => {
    if (!isFormValid) return
    const payload = buildPayload(form)
    if (payload === null) return
    if (editingId !== null) {
      updateModel(editingId, payload as Partial<CatalogModel>)
      toast.success('Модель обновлена')
    } else {
      addModel(payload)
      toast.success('Модель добавлена в каталог')
    }
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleDelete = (id: string) => {
    deleteModel(id)
    if (editingId === id) {
      setEditingId(null)
      setForm(EMPTY_FORM)
    }
    toast.success('Модель удалена')
  }

  const handleReset = () => {
    if (
      !window.confirm('Сбросить каталог к умолчаниям? Все пользовательские правки будут удалены.')
    ) {
      return
    }
    resetToSeed()
    setEditingId(null)
    setForm(EMPTY_FORM)
    toast.success('Каталог сброшен к умолчаниям')
  }

  const handleNewModel = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleRowClick = (m: CatalogModel) => {
    setEditingId(m.id)
    populateFormFromModel(m, setForm)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-editor-title"
    >
      <div
        className="max-w-[760px] w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h3
          id="catalog-editor-title"
          className="text-base font-semibold text-[var(--color-text-primary)] mb-3"
        >
          Каталог приборов
        </h3>

        <div className="flex gap-4 flex-1 overflow-hidden">
          <CatalogModelList
            models={filteredModels}
            filter={filter}
            onFilterChange={setFilter}
            editingId={editingId}
            onRowClick={handleRowClick}
            onDelete={handleDelete}
            onNewModel={handleNewModel}
          />
          <CatalogModelForm form={form} setForm={setForm} />
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)]"
          >
            Сбросить к умолчанию
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isFormValid}
              className={`px-3 py-1.5 text-sm rounded ${
                isFormValid
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] cursor-not-allowed'
              }`}
            >
              {editingId !== null ? 'Обновить' : 'Добавить'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] text-[var(--color-text-primary)]"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
