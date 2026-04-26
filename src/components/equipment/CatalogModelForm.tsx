/**
 * Right-column form for CatalogEditorModal.
 * Conditional fields по kind: panel / underfloor-convector / sectional.
 * Вынесено из CatalogEditorModal.tsx чтобы держать главный файл < 500 строк.
 */

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { EquipmentKind, PanelType } from '../../types/project'
import { INPUT_CLASS, KIND_LABELS } from './equipment-help'
import {
  DEFAULT_CONVECTOR_VARIANTS_JSON,
  DEFAULT_PANEL_VARIANTS_JSON,
  validVariantsJSON,
  type FormState,
} from './catalog-editor-helpers'

interface CatalogModelFormProps {
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
}

export function CatalogModelForm({ form, setForm }: CatalogModelFormProps) {
  const handleKindChange = (kind: EquipmentKind) => {
    setForm(f => ({
      ...f,
      kind,
      // Dropping variantsJSON в дефолт соответствующего kind, чтобы пользователь
      // не пытался сохранить panel с convector-JSON.
      variantsJSON:
        kind === 'panel'
          ? DEFAULT_PANEL_VARIANTS_JSON
          : kind === 'underfloor-convector'
            ? DEFAULT_CONVECTOR_VARIANTS_JSON
            : f.variantsJSON,
    }))
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
      <FormField label="Тип прибора">
        <select
          value={form.kind}
          onChange={e => handleKindChange(e.target.value as EquipmentKind)}
          className={INPUT_CLASS}
        >
          {(Object.keys(KIND_LABELS) as EquipmentKind[]).map(k => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Производитель">
        <input
          type="text"
          value={form.manufacturer}
          onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
          className={INPUT_CLASS}
          aria-label="Производитель"
        />
      </FormField>

      <FormField label="Серия">
        <input
          type="text"
          value={form.series}
          onChange={e => setForm(f => ({ ...f, series: e.target.value }))}
          className={INPUT_CLASS}
          aria-label="Серия"
        />
      </FormField>

      <FormField label="Показатель n">
        <input
          type="number"
          min={1.0}
          max={2.0}
          step={0.01}
          value={form.nExponent}
          onChange={e =>
            setForm(f => ({ ...f, nExponent: parseFloat(e.target.value) || 1.3 }))
          }
          className={INPUT_CLASS}
          aria-label="Показатель n"
        />
      </FormField>

      {form.kind === 'panel' && (
        <>
          <FormField label="Тип панели">
            <select
              value={form.panelType}
              onChange={e => setForm(f => ({ ...f, panelType: e.target.value as PanelType }))}
              className={INPUT_CLASS}
            >
              <option value="11">11</option>
              <option value="21">21</option>
              <option value="22">22</option>
              <option value="33">33</option>
            </select>
          </FormField>
          <FormField label="Варианты (JSON [{heightMm, lengthMm, qAt70}])">
            <textarea
              value={form.variantsJSON}
              rows={6}
              onChange={e => setForm(f => ({ ...f, variantsJSON: e.target.value }))}
              className={`${INPUT_CLASS} font-mono w-full`}
              aria-label="Варианты типоразмеров — JSON"
            />
            {!validVariantsJSON(form.variantsJSON, 'panel') && (
              <span className="text-xs text-[var(--color-destructive)]">
                Неверный JSON формат (ожидаются heightMm, lengthMm, qAt70 &gt; 0)
              </span>
            )}
          </FormField>
        </>
      )}

      {form.kind === 'underfloor-convector' && (
        <>
          <FormField label="Ширина корпуса, мм">
            <input
              type="number"
              min={50}
              max={500}
              value={form.widthMm}
              onChange={e => setForm(f => ({ ...f, widthMm: parseInt(e.target.value) || 0 }))}
              className={INPUT_CLASS}
            />
          </FormField>
          <FormField label="Глубина корпуса, мм">
            <input
              type="number"
              min={50}
              max={300}
              value={form.depthMm}
              onChange={e => setForm(f => ({ ...f, depthMm: parseInt(e.target.value) || 0 }))}
              className={INPUT_CLASS}
            />
          </FormField>
          <FormField label="Варианты (JSON [{lengthMm, qAt70}])">
            <textarea
              value={form.variantsJSON}
              rows={6}
              onChange={e => setForm(f => ({ ...f, variantsJSON: e.target.value }))}
              className={`${INPUT_CLASS} font-mono w-full`}
              aria-label="Варианты типоразмеров — JSON"
            />
            {!validVariantsJSON(form.variantsJSON, 'convector') && (
              <span className="text-xs text-[var(--color-destructive)]">
                Неверный JSON формат (ожидаются lengthMm, qAt70 &gt; 0)
              </span>
            )}
          </FormField>
        </>
      )}

      {(form.kind === 'bimetal' ||
        form.kind === 'aluminum' ||
        form.kind === 'cast-iron') && (
        <>
          <FormField label="Q/секция при ΔT=70, Вт">
            <input
              type="number"
              min={10}
              max={10000}
              value={form.qPerSectionAt70}
              onChange={e =>
                setForm(f => ({ ...f, qPerSectionAt70: parseFloat(e.target.value) || 0 }))
              }
              className={INPUT_CLASS}
              aria-label="Q на секцию при ΔT=70"
            />
          </FormField>
          <FormField label="Высота, мм">
            <input
              type="number"
              min={100}
              max={2000}
              value={form.heightMm}
              onChange={e => setForm(f => ({ ...f, heightMm: parseInt(e.target.value) || 0 }))}
              className={INPUT_CLASS}
            />
          </FormField>
          <FormField label="Ширина секции, мм">
            <input
              type="number"
              min={30}
              max={200}
              value={form.sectionWidthMm}
              onChange={e =>
                setForm(f => ({ ...f, sectionWidthMm: parseInt(e.target.value) || 0 }))
              }
              className={INPUT_CLASS}
            />
          </FormField>
          <FormField label="Макс. секций">
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={form.maxSections}
              onChange={e =>
                setForm(f => ({ ...f, maxSections: parseInt(e.target.value) || 0 }))
              }
              className={INPUT_CLASS}
            />
          </FormField>
        </>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
      {children}
    </div>
  )
}
