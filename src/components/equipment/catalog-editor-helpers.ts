/**
 * Pure helpers for CatalogEditorModal — кроме JSX.
 * FormState + EMPTY_FORM + validateForm + validVariantsJSON + buildPayload +
 * populateFormFromModel (BLOCKER-4 fix).
 * Вынесено из CatalogEditorModal.tsx чтобы держать модалку < 500 строк.
 */

import type { Dispatch, SetStateAction } from 'react'
import type { CatalogModel, EquipmentKind, PanelType } from '../../types/project'

export interface FormState {
  kind: EquipmentKind
  manufacturer: string
  series: string
  nExponent: number
  qPerSectionAt70: number
  heightMm: number
  sectionWidthMm: number
  maxSections: number
  panelType: PanelType
  widthMm: number
  depthMm: number
  variantsJSON: string
}

export const DEFAULT_PANEL_VARIANTS_JSON =
  '[\n  { "heightMm": 500, "lengthMm": 1000, "qAt70": 1500 }\n]'
export const DEFAULT_CONVECTOR_VARIANTS_JSON =
  '[\n  { "lengthMm": 1000, "qAt70": 900 }\n]'

export const EMPTY_FORM: FormState = {
  kind: 'bimetal',
  manufacturer: '',
  series: '',
  nExponent: 1.3,
  qPerSectionAt70: 200,
  heightMm: 500,
  sectionWidthMm: 80,
  maxSections: 14,
  panelType: '22',
  widthMm: 300,
  depthMm: 90,
  variantsJSON: DEFAULT_PANEL_VARIANTS_JSON,
}

export function validateForm(form: FormState): boolean {
  if (form.manufacturer.trim().length === 0) return false
  if (form.series.trim().length === 0) return false
  if (!Number.isFinite(form.nExponent) || form.nExponent < 1.0 || form.nExponent > 2.0) return false

  if (form.kind === 'panel') {
    return validVariantsJSON(form.variantsJSON, 'panel')
  }
  if (form.kind === 'underfloor-convector') {
    if (!(form.widthMm > 0) || !(form.depthMm > 0)) return false
    return validVariantsJSON(form.variantsJSON, 'convector')
  }
  // sectional: bimetal | aluminum | cast-iron
  return (
    form.qPerSectionAt70 > 0 &&
    form.qPerSectionAt70 <= 10000 &&
    form.heightMm > 0 &&
    form.sectionWidthMm > 0 &&
    Number.isInteger(form.maxSections) &&
    form.maxSections >= 1 &&
    form.maxSections <= 30
  )
}

export function validVariantsJSON(json: string, kind: 'panel' | 'convector'): boolean {
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr) || arr.length === 0) return false
    for (const v of arr) {
      if (typeof v !== 'object' || v === null) return false
      const variant = v as Record<string, unknown>
      if (kind === 'panel') {
        if (typeof variant.heightMm !== 'number' || variant.heightMm <= 0) return false
        if (typeof variant.lengthMm !== 'number' || variant.lengthMm <= 0) return false
      } else {
        if (typeof variant.lengthMm !== 'number' || variant.lengthMm <= 0) return false
      }
      if (typeof variant.qAt70 !== 'number' || variant.qAt70 <= 0) return false
    }
    return true
  } catch {
    return false
  }
}

export function buildPayload(form: FormState): Omit<CatalogModel, 'id' | 'isCustom'> | null {
  const baseFields = {
    manufacturer: form.manufacturer.trim(),
    series: form.series.trim(),
    nExponent: form.nExponent,
  }
  try {
    if (form.kind === 'panel') {
      return {
        ...baseFields,
        kind: 'panel',
        panelType: form.panelType,
        variants: JSON.parse(form.variantsJSON),
      } as Omit<CatalogModel, 'id' | 'isCustom'>
    }
    if (form.kind === 'underfloor-convector') {
      return {
        ...baseFields,
        kind: 'underfloor-convector',
        widthMm: form.widthMm,
        depthMm: form.depthMm,
        variants: JSON.parse(form.variantsJSON),
      } as Omit<CatalogModel, 'id' | 'isCustom'>
    }
    return {
      ...baseFields,
      kind: form.kind,
      qPerSectionAt70: form.qPerSectionAt70,
      heightMm: form.heightMm,
      sectionWidthMm: form.sectionWidthMm,
      maxSections: form.maxSections,
    } as Omit<CatalogModel, 'id' | 'isCustom'>
  } catch {
    return null
  }
}

/**
 * BLOCKER-4 FIX: копирует ВСЕ поля модели в form state при click по строке списка.
 * Без этого click → "Обновить" без изменений → updateModel получает EMPTY_FORM
 * и затирает реальные поля модели.
 */
export function populateFormFromModel(
  m: CatalogModel,
  setForm: Dispatch<SetStateAction<FormState>>,
): void {
  const base = {
    kind: m.kind,
    manufacturer: m.manufacturer,
    series: m.series,
    nExponent: m.nExponent,
  }
  if (m.kind === 'panel') {
    setForm(f => ({
      ...f,
      ...base,
      panelType: m.panelType,
      variantsJSON: JSON.stringify(m.variants, null, 2),
    }))
  } else if (m.kind === 'underfloor-convector') {
    setForm(f => ({
      ...f,
      ...base,
      widthMm: m.widthMm,
      depthMm: m.depthMm,
      variantsJSON: JSON.stringify(m.variants, null, 2),
    }))
  } else {
    setForm(f => ({
      ...f,
      ...base,
      qPerSectionAt70: m.qPerSectionAt70,
      heightMm: m.heightMm,
      sectionWidthMm: m.sectionWidthMm,
      maxSections: m.maxSections,
    }))
  }
}
