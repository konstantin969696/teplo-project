/**
 * Pure equipment selection functions per SP 60.13330.2020 + EN 442.
 * LMTD (среднелогарифмический температурный напор), поправочные коэффициенты
 * схемы подключения и места установки, расчёт числа секций, автоподбор
 * типоразмера панельного радиатора.
 * Zero React imports -- safe for Web Worker usage in Phase 6.
 */

import type {
  ConnectionScheme,
  EquipmentKind,
  InstallationPlace,
  PanelCatalogModel,
  PanelVariantResult,
} from '../types/project'

/** ΔT_ном — эталонный температурный напор, к которому приведены каталожные мощности. */
export const NOMINAL_DELTA_T = 70 as const

/** Поправочные коэффициенты схемы подключения per CONTEXT.md D-05 specifics. */
export const CONNECTION_SCHEME_COEFF: Record<ConnectionScheme, number> = {
  side: 1.0,
  bottom: 0.88,
  diagonal: 0.95,
}

/** Поправочные коэффициенты места установки per CONTEXT.md D-06 specifics. */
export const INSTALLATION_COEFF: Record<InstallationPlace, number> = {
  'open': 1.0,
  'niche': 0.9,
  'under-sill': 0.95,
}

/** Дефолтный показатель степени n по типу прибора (когда не задан в каталоге). */
export const DEFAULT_N_EXPONENT: Record<EquipmentKind, number> = {
  'panel': 1.3,
  'bimetal': 1.3,
  'aluminum': 1.32,
  'cast-iron': 1.34,
  'underfloor-convector': 1.4,
}

/**
 * Среднелогарифмический температурный напор по EN 442.
 * LMTD = (Δt₁ - Δt₂) / ln(Δt₁ / Δt₂), где Δt₁ = tSupply - tRoom, Δt₂ = tReturn - tRoom.
 * Pitfall 1: вырожденный случай tSupply == tReturn → ln(1)=0, защищаемся fallback на dt1.
 * Неработоспособная система (tSupply<=tRoom или tReturn<=tRoom) → возвращаем 0.
 */
export function calculateLMTD(tSupply: number, tReturn: number, tRoom: number): number {
  const dt1 = tSupply - tRoom
  const dt2 = tReturn - tRoom
  if (dt1 <= 0 || dt2 <= 0) return 0
  if (Math.abs(dt1 - dt2) < 0.001) return dt1
  return (dt1 - dt2) / Math.log(dt1 / dt2)
}

/**
 * Коррекция номинальной мощности под реальный LMTD и коэффициенты установки/подключения.
 * Q_факт = Q_ном × (LMTD / 70)^n × k_подкл × k_устан.
 * Pitfall 5: дробь именно LMTD/70 (не 70/LMTD) — при LMTD<70 должна снижать Q, не увеличивать.
 */
export function correctQNominal(
  qNominal: number,
  nExponent: number,
  lmtd: number,
  connection: ConnectionScheme,
  installation: InstallationPlace
): number {
  if (lmtd <= 0 || qNominal <= 0) return 0
  const lmtdRatio = Math.pow(lmtd / NOMINAL_DELTA_T, nExponent)
  return qNominal * lmtdRatio * CONNECTION_SCHEME_COEFF[connection] * INSTALLATION_COEFF[installation]
}

/**
 * Расчёт числа секций для секционного радиатора.
 * N_расч = Q_required / Q_факт_на_секцию; N_прин = ceil(N_расч), минимум 1 (Pitfall 6).
 * Если LMTD=0 (система неработоспособна) — возвращаем {0, 0} чтобы UI показал '—'.
 */
export function calculateSections(
  qRequired: number,
  qPerSectionNominal: number,
  nExponent: number,
  lmtd: number,
  connection: ConnectionScheme,
  installation: InstallationPlace
): { calculated: number; accepted: number } {
  const qFactPerSection = correctQNominal(qPerSectionNominal, nExponent, lmtd, connection, installation)
  if (qFactPerSection <= 0) return { calculated: 0, accepted: 0 }
  const calc = qRequired / qFactPerSection
  return { calculated: calc, accepted: Math.max(1, Math.ceil(calc)) }
}

/**
 * Автоподбор типоразмера панельного радиатора.
 * Ищем наименьший вариант, удовлетворяющий Q_actual >= Q_required (D-04: ближайший сверху).
 * Если ни один не покрывает — chosen=null, alternatives = top-3 по мощности (D-05 trigger).
 */
export function selectPanelSize(
  qRequired: number,
  model: PanelCatalogModel,
  lmtd: number,
  connection: ConnectionScheme,
  installation: InstallationPlace
): { chosen: PanelVariantResult | null; alternatives: readonly PanelVariantResult[] } {
  const corrected: PanelVariantResult[] = model.variants
    .map(v => ({
      heightMm: v.heightMm,
      lengthMm: v.lengthMm,
      qNominal: v.qAt70,
      qActual: correctQNominal(v.qAt70, model.nExponent, lmtd, connection, installation),
    }))
    .slice()
    .sort((a, b) => a.qActual - b.qActual)

  const chosen = corrected.find(v => v.qActual >= qRequired) ?? null
  const alternatives = chosen
    ? corrected.filter(v => v !== chosen).slice(-3)
    : corrected.slice(-3)
  return { chosen, alternatives }
}

/** Аудит-строка расчёта LMTD: формула → подстановка → результат. */
export function buildLMTDAuditString(
  tSupply: number,
  tReturn: number,
  tRoom: number,
  lmtd: number
): string {
  const dt1 = tSupply - tRoom
  const dt2 = tReturn - tRoom
  return [
    'LMTD = (Δt₁ - Δt₂) / ln(Δt₁ / Δt₂)',
    `     = (${dt1.toFixed(1)} - ${dt2.toFixed(1)}) / ln(${dt1.toFixed(1)} / ${dt2.toFixed(1)})`,
    `     = ${lmtd.toFixed(2)} °C`,
  ].join('\n')
}

/** Аудит-строка коррекции Q_ном → Q_факт. */
export function buildCorrectionAuditString(
  qNom: number,
  n: number,
  lmtd: number,
  kConn: number,
  kInst: number,
  qActual: number
): string {
  return [
    'Q_факт = Q_ном × (LMTD/70)^n × k_подкл × k_устан',
    `      = ${qNom.toFixed(1)} × (${lmtd.toFixed(2)}/70)^${n.toFixed(2)} × ${kConn.toFixed(2)} × ${kInst.toFixed(2)}`,
    `      = ${qActual.toFixed(1)} Вт`,
  ].join('\n')
}

/**
 * Форматирование числа для аудит-строк: целые без десятичных (1000), дробные с 1 знаком (126.5).
 * Исключает визуальный мусор вида "1000.0" в выводе формул.
 */
function formatAuditNumber(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1)
}

/** Аудит-строка расчёта числа секций. */
export function buildSectionsAuditString(
  qReq: number,
  qFactSec: number,
  calc: number,
  accepted: number
): string {
  return [
    'N = Q_required / Q_факт_на_секцию',
    `  = ${formatAuditNumber(qReq)} / ${formatAuditNumber(qFactSec)}`,
    `  = ${calc.toFixed(2)} → округление вверх = ${accepted}`,
  ].join('\n')
}
