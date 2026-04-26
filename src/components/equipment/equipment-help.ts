/**
 * Shared UI helpers for Phase 3 equipment components.
 * Zero component imports — pure TS, reusable across the equipment/ directory.
 * Houses: INPUT_CLASS (same string as heatLoss/RoomRow.tsx line 25),
 * getEffectiveNExponent (manual > model > default priority),
 * formatSurplusPct (signed percentage or em-dash for NaN/zero-req),
 * KIND/CONNECTION/INSTALLATION label maps for human-readable UI.
 */

import type { CatalogModel, ConvectorCatalogModel, Equipment, PanelCatalogModel } from '../../types/project'
import { DEFAULT_N_EXPONENT, calculateSections, correctQNominal } from '../../engine/equipment'

export const INPUT_CLASS = 'border border-[var(--color-border)] rounded px-2 py-1 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors'

/**
 * Effective exponent for EN 442 LMTD correction.
 * Priority: manualNExponent (D-02) > model.nExponent (catalog) > DEFAULT_N_EXPONENT[kind].
 */
export function getEffectiveNExponent(equipment: Equipment, model: CatalogModel | null): number {
  if (equipment.manualNExponent !== null) return equipment.manualNExponent
  if (model) return model.nExponent
  return DEFAULT_N_EXPONENT[equipment.kind]
}

/**
 * Signed percentage surplus of actual vs required Q.
 * "+12.3%" positive, "-4.7%" negative, "—" for NaN or zero-required.
 */
export function formatSurplusPct(qActual: number, qRequired: number): string {
  if (!Number.isFinite(qActual) || !Number.isFinite(qRequired) || qRequired <= 0) return '—'
  const pct = ((qActual - qRequired) / qRequired) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export const KIND_LABELS: Record<string, string> = {
  'panel': 'Панельный',
  'bimetal': 'Биметаллический',
  'aluminum': 'Алюминиевый',
  'cast-iron': 'Чугунный',
  'underfloor-convector': 'Внутрипольный конвектор',
}

export const CONNECTION_LABELS: Record<string, string> = {
  'side': 'Боковое',
  'bottom': 'Нижнее',
  'diagonal': 'Диагональное',
}

export const INSTALLATION_LABELS: Record<string, string> = {
  'open': 'Открытая',
  'niche': 'В нише',
  'under-sill': 'Под подоконником',
}

/**
 * Pure derivation of Q_факт and calculated sections for a single equipment.
 * Extracted so multi-equipment rooms can sum Q_факт across devices without
 * duplicating the branching logic between EquipmentRow and EquipmentResultsTable.
 *
 * For sectional kinds, `qRequiredForSectionPick` is what calculateSections()
 * uses to choose section count if the user hasn't overridden. Passing the
 * room's total Q here keeps behaviour identical to v1 single-equipment;
 * when multiple equipment split the load, callers can pass a per-equipment
 * target (e.g. qRequired/equipmentCount) — but v1 simple behaviour = whole Q.
 */
export interface DerivedEquipment {
  qActual: number | null
  sectionsCalc: number | null       // raw decimal — useful for audit strings
  sectionsAccepted: number | null   // integer used in qActual — display in спецификации
}

export function deriveEquipmentQActual(
  equipment: Equipment,
  model: CatalogModel | null,
  qRequiredForSectionPick: number | null,
  lmtd: number
): DerivedEquipment {
  if (qRequiredForSectionPick === null || lmtd <= 0) {
    return { qActual: null, sectionsCalc: null, sectionsAccepted: null }
  }
  const nExp = getEffectiveNExponent(equipment, model)

  if (equipment.kind === 'panel') {
    const panelModel = model && model.kind === 'panel' ? (model as PanelCatalogModel) : null
    const qNom = equipment.manualQNominal ?? (
      panelModel
        ? panelModel.variants.find(
            v => v.heightMm === equipment.panelHeightMm && v.lengthMm === equipment.panelLengthMm
          )?.qAt70 ?? null
        : null
    )
    const qActual = qNom !== null
      ? correctQNominal(qNom, nExp, lmtd, equipment.connection, equipment.installation)
      : null
    return { qActual, sectionsCalc: null, sectionsAccepted: null }
  }

  if (equipment.kind === 'underfloor-convector') {
    const convModel = model && model.kind === 'underfloor-convector' ? (model as ConvectorCatalogModel) : null
    const qNom = equipment.manualQNominal ?? (
      convModel
        ? convModel.variants.find(v => v.lengthMm === equipment.convectorLengthMm)?.qAt70 ?? null
        : null
    )
    const qActual = qNom !== null
      ? correctQNominal(qNom, nExp, lmtd, equipment.connection, equipment.installation)
      : null
    return { qActual, sectionsCalc: null, sectionsAccepted: null }
  }

  // Sectional kinds (bimetal / aluminum / cast-iron)
  const isSectional = model !== null && (model.kind === 'bimetal' || model.kind === 'aluminum' || model.kind === 'cast-iron')
  const qPerSection = equipment.manualQNominal ?? (
    isSectional && model !== null && 'qPerSectionAt70' in model
      ? model.qPerSectionAt70
      : null
  )
  if (qPerSection === null) return { qActual: null, sectionsCalc: null, sectionsAccepted: null }

  const selection = calculateSections(
    qRequiredForSectionPick, qPerSection, nExp, lmtd,
    equipment.connection, equipment.installation
  )
  const perSec = correctQNominal(qPerSection, nExp, lmtd, equipment.connection, equipment.installation)
  const sections = equipment.sectionsOverride ?? selection.accepted
  return {
    qActual: perSec * sections,
    sectionsCalc: selection.calculated,
    sectionsAccepted: sections,
  }
}
