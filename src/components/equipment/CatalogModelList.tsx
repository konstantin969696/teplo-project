/**
 * Left-column list of catalog models for CatalogEditorModal.
 * Filter by kind + scrollable <ul> with edit/delete buttons per row.
 * Вынесено из CatalogEditorModal.tsx чтобы держать главный файл < 500 строк.
 */

import { Plus, Trash2 } from 'lucide-react'
import type { CatalogModel, EquipmentKind } from '../../types/project'
import { INPUT_CLASS, KIND_LABELS } from './equipment-help'

interface CatalogModelListProps {
  models: readonly CatalogModel[]
  filter: EquipmentKind | 'all'
  onFilterChange: (f: EquipmentKind | 'all') => void
  editingId: string | null
  onRowClick: (m: CatalogModel) => void
  onDelete: (id: string) => void
  onNewModel: () => void
}

export function CatalogModelList({
  models,
  filter,
  onFilterChange,
  editingId,
  onRowClick,
  onDelete,
  onNewModel,
}: CatalogModelListProps) {
  return (
    <div className="w-[260px] flex flex-col gap-2 overflow-hidden">
      <select
        value={filter}
        onChange={e => onFilterChange(e.target.value as EquipmentKind | 'all')}
        className={INPUT_CLASS}
        aria-label="Фильтр по типу прибора"
      >
        <option value="all">Все типы</option>
        {(Object.keys(KIND_LABELS) as EquipmentKind[]).map(k => (
          <option key={k} value={k}>
            {KIND_LABELS[k]}
          </option>
        ))}
      </select>
      <ul className="overflow-y-auto flex-1 border border-[var(--color-border)] rounded">
        {models.map(m => {
          const isActive = editingId === m.id
          return (
            <li
              key={m.id}
              className={`flex items-center justify-between px-2 py-1 text-xs hover:bg-[var(--color-surface)] ${
                isActive ? 'bg-[var(--color-surface)]' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onRowClick(m)}
                className="flex-1 text-left text-[var(--color-text-primary)] cursor-pointer py-1"
                aria-label={`Редактировать ${m.manufacturer} ${m.series}`}
              >
                {m.manufacturer} {m.series}{' '}
                <span className="text-[var(--color-text-secondary)]">
                  [{m.isCustom ? 'польз.' : 'встр.'}]
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(m.id)}
                title="Удалить"
                aria-label={`Удалить ${m.series}`}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-destructive)] p-1"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </li>
          )
        })}
        {models.length === 0 && (
          <li className="px-2 py-3 text-xs text-[var(--color-text-secondary)] italic">
            Нет моделей
          </li>
        )}
      </ul>
      <button
        type="button"
        onClick={onNewModel}
        className="text-xs text-[var(--color-accent)] flex items-center gap-1 py-1"
      >
        <Plus size={12} aria-hidden="true" /> Новая модель
      </button>
    </div>
  )
}
