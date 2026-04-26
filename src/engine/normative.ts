/**
 * Normative thermal resistance check per СП 50.13330.2012 Table 3.
 *
 * R_норм = a · ГСОП + b  (for residential and public buildings)
 *
 * The coefficients {a, b} depend on the enclosure type. A user-chosen K value
 * yields R_факт = 1/K; compliance is R_факт ≥ R_норм. We report three tiers:
 *   pass      — R_факт ≥ R_норм               (passes by the letter of the SP)
 *   marginal  — 0.85·R_норм ≤ R_факт < R_норм (passes санитарный минимум but
 *                                               flunks energy efficiency)
 *   fail      — R_факт < 0.85·R_норм          (does not satisfy norms —
 *                                               expertise would reject this)
 *
 * The output is intentionally informational: the engine never overrides the
 * user's K. It surfaces a verdict the engineer can act on.
 */

import type { EnclosureType } from '../types/project'

export interface NormativeVerdict {
  readonly tier: 'pass' | 'marginal' | 'fail' | 'not-applicable'
  readonly rActual: number        // 1/K
  readonly rNormative: number     // a·ГСОП + b (или 0 если not-applicable)
  readonly deltaPct: number       // (R_факт − R_норм)/R_норм · 100  (neg → недобор)
  readonly hint: string
}

/**
 * Coefficients from СП 50.13330.2012 Table 3, "жилые и общественные здания".
 * The residential a·ГСОП+b rule does not apply to wall-int/ceiling-int
 * (internal partitions) or to floor-ground (handled by zonal R_red).
 */
const NORMATIVE_TABLE: Record<EnclosureType, { a: number; b: number } | null> = {
  'wall-ext':    { a: 0.00035, b: 1.4 },
  'ceiling':     { a: 0.00035, b: 1.3 },  // чердачные + над подвалом = одинаковые коэфф.
  'roof':        { a: 0.00045, b: 1.9 },  // покрытия + над проездами
  'window':      { a: 0.00005, b: 0.3 },
  'door-ext':    null,  // СП 50 не нормирует двери через ГСОП — используем фикс. 0.6
  'wall-int':    null,
  'ceiling-int': null,
  'floor-ground': null, // зональный расчёт (R_ред), отдельная механика
}

/** Fixed R_норм for external doors (common rule-of-thumb: R ≥ 0.6 м²·°C/Вт). */
const DOOR_FIXED_R_NORM = 0.6

/**
 * Compute normative verdict for a given enclosure type, K value, and ГСОП.
 * Returns `not-applicable` for types without a normative rule.
 */
export function checkNormative(
  type: EnclosureType,
  kValue: number,
  gsop: number | null
): NormativeVerdict {
  if (!Number.isFinite(kValue) || kValue <= 0) {
    return {
      tier: 'not-applicable',
      rActual: 0,
      rNormative: 0,
      deltaPct: 0,
      hint: 'K не задан — нет данных для проверки.'
    }
  }

  const rActual = 1 / kValue
  const coeffs = NORMATIVE_TABLE[type]

  // Internal partitions / floor-ground → нет нормативной проверки по ГСОП
  if (coeffs === null && type !== 'door-ext') {
    return {
      tier: 'not-applicable',
      rActual,
      rNormative: 0,
      deltaPct: 0,
      hint: type === 'floor-ground'
        ? 'Пол по грунту — расчёт по зонам (R_ред), нормативная проверка по ГСОП не применяется.'
        : 'Внутренняя конструкция — нормирование по ГСОП не применяется.'
    }
  }

  // External door — fixed R_норм
  let rNorm: number
  if (type === 'door-ext') {
    rNorm = DOOR_FIXED_R_NORM
  } else {
    if (gsop === null || !Number.isFinite(gsop)) {
      return {
        tier: 'not-applicable',
        rActual,
        rNormative: 0,
        deltaPct: 0,
        hint: 'ГСОП не определён (выбери город) — нормативная проверка недоступна.'
      }
    }
    rNorm = coeffs!.a * gsop + coeffs!.b
  }

  const deltaPct = ((rActual - rNorm) / rNorm) * 100
  const tier: NormativeVerdict['tier'] = rActual >= rNorm
    ? 'pass'
    : rActual >= rNorm * 0.85
      ? 'marginal'
      : 'fail'

  const hint = formatHint(tier, rActual, rNorm, type)
  return { tier, rActual, rNormative: rNorm, deltaPct, hint }
}

function formatHint(
  tier: NormativeVerdict['tier'],
  rActual: number,
  rNorm: number,
  type: EnclosureType
): string {
  const rAct = rActual.toFixed(2)
  const rN = rNorm.toFixed(2)
  const typeLabel = ({
    'wall-ext':    'наружной стены',
    'ceiling':     'перекрытия',
    'roof':        'покрытия',
    'window':      'окна',
    'door-ext':    'наружной двери',
    'wall-int':    'внутренней стены',
    'ceiling-int': 'межэтажного перекрытия',
    'floor-ground':'пола по грунту',
  } as Record<EnclosureType, string>)[type]

  switch (tier) {
    case 'pass':
      return `Проходит СП 50.13330 — R_факт = ${rAct} ≥ R_норм = ${rN} м²·°C/Вт.`
    case 'marginal':
      return `Погран. зона — санитарный минимум ок, но энергоэффективность ниже нормы. R_факт = ${rAct} (норма для ${typeLabel}: R ≥ ${rN}).`
    case 'fail':
      return `НЕ проходит СП 50.13330 — R_факт = ${rAct} < R_норм = ${rN} м²·°C/Вт. Экспертиза откажет. Требуется дополнительное утепление.`
    default:
      return ''
  }
}
