/** UFH calculations per EN 1264 / СП 60. Pure TS — safe for Web Worker. */

import { frictionFactor, pressureLossLinear } from './darcyWeisbach'
import { reynolds } from './reynolds'
import { calculateFlowRate } from './hydraulics'
import type { CoolantSpec, FloorCovering, PipeSpec } from '../types/hydraulics'

/** Поправочные коэффициенты покрытия (эмпирические, справочные). */
export const COVERING_COEFF: Record<FloorCovering, number> = {
  tile:     1.00,
  laminate: 0.60,
  parquet:  0.50,
  linoleum: 0.70,
}

/** α_tot по EN 1264-5 — суммарный коэффициент теплоотдачи пола в помещение, Вт/(м²·K). */
export const ALPHA_FLOOR_TOTAL = 10.8 as const

/**
 * UFH-03: Удельная теплоотдача с пола.
 * q = 8.92·(t_ср_ТП − t_вн)^1.1 · k_покр
 * @param tSupply - температура подачи УФН, °C
 * @param tReturn - температура обратки УФН, °C
 * @param tRoom - температура воздуха в помещении, °C
 * @param covering - тип покрытия пола
 */
export function calculateHeatFlux(
  tSupply: number,
  tReturn: number,
  tRoom: number,
  covering: FloorCovering
): number {
  const tMean = (tSupply + tReturn) / 2
  const deltaT = tMean - tRoom
  if (deltaT <= 0) return 0
  const qRaw = 8.92 * Math.pow(deltaT, 1.1)
  return qRaw * COVERING_COEFF[covering]
}

/**
 * UFH-04: Средняя температура пола.
 * t_пол = t_вн + q / α_tot
 */
export function calculateFloorTemp(q: number, tRoom: number): number {
  return tRoom + q / ALPHA_FLOOR_TOTAL
}

/**
 * UFH-05: Длина контура.
 * L = F_тп·100/шаг_см + 2·L_подводка
 * @param areaM2 - активная площадь тёплого пола, м²
 * @param stepCm - шаг укладки трубы, см
 * @param leadInM - длина подводки (в один конец), м (дефолт 3 м)
 */
export function calculateLoopLength(areaM2: number, stepCm: number, leadInM: number = 3): number {
  if (stepCm <= 0 || areaM2 <= 0) return 0
  return (areaM2 * 100 / stepCm) + 2 * leadInM
}

/**
 * UFH-06: Число контуров по ограничению макс. длины для типоразмера трубы.
 * N = max(1, ceil(L / L_max))
 */
export function calculateLoopCount(totalLengthM: number, maxLengthPerLoopM: number): number {
  if (maxLengthPerLoopM <= 0) return 1
  return Math.max(1, Math.ceil(totalLengthM / maxLengthPerLoopM))
}

/** Результат гидравлического расчёта одного контура УФН. */
export interface UfhLoopHydraulicsResult {
  readonly flowKgH: number
  readonly velocityMS: number
  readonly re: number
  readonly lambda: number
  readonly deltaPLinearPa: number
  readonly deltaPManifoldPa: number   // ζ_коллектор суммарно ≈ 2.5 (фикс)
  readonly deltaPTotalPa: number
}

const MANIFOLD_ZETA_SUM = 2.5  // коллектор входа + выхода + балансировка (инж. практика)

/**
 * UFH-07: Гидравлика одного контура УФН.
 * G·ΔP с учётом КМС коллектора (ζ фикс ≈ 2.5).
 * @param qTotalW - тепловая нагрузка контура, Вт
 * @param tSupply - температура подачи, °C
 * @param tReturn - температура обратки, °C
 * @param pipe - характеристика трубы
 * @param coolant - характеристика теплоносителя
 * @param loopLengthM - длина контура, м
 */
export function calculateLoopHydraulics(
  qTotalW: number,
  tSupply: number,
  tReturn: number,
  pipe: PipeSpec,
  coolant: CoolantSpec,
  loopLengthM: number
): UfhLoopHydraulicsResult {
  const deltaTK = tSupply - tReturn
  const flowKgH = calculateFlowRate(qTotalW, coolant.cKjKgK, deltaTK > 0 ? deltaTK : 1)
  const dInnerM = pipe.innerDiameterMm / 1000
  // v = G / (ρ · A · 3600)
  const area = Math.PI * dInnerM * dInnerM / 4
  const velocityMS = flowKgH > 0 && coolant.rhoKgM3 > 0 && area > 0
    ? flowKgH / (coolant.rhoKgM3 * area * 3600)
    : 0
  const re = reynolds(velocityMS, dInnerM, coolant.nuM2S)
  const lambda = frictionFactor(re, pipe.roughnessMm, pipe.innerDiameterMm)
  const deltaPLinearPa = pressureLossLinear(lambda, loopLengthM, dInnerM, coolant.rhoKgM3, velocityMS)
  // Местные потери коллектора: ΔP_мест = Σζ·ρ·v²/2
  const deltaPManifoldPa = velocityMS > 0 && coolant.rhoKgM3 > 0
    ? MANIFOLD_ZETA_SUM * coolant.rhoKgM3 * velocityMS * velocityMS / 2
    : 0
  const deltaPTotalPa = deltaPLinearPa + deltaPManifoldPa
  return { flowKgH, velocityMS, re, lambda, deltaPLinearPa, deltaPManifoldPa, deltaPTotalPa }
}

/**
 * Строка аудита для расчёта UFН-контура.
 */
export function buildUfhAuditString(
  tSupply: number,
  tReturn: number,
  tRoom: number,
  covering: FloorCovering,
  areaM2: number,
  stepCm: number,
  qPerM2: number,
  totalQ: number,
  floorT: number,
  loopLength: number,
  loopCount: number
): string {
  const tMean = (tSupply + tReturn) / 2
  const deltaT = tMean - tRoom
  const kCov = COVERING_COEFF[covering]
  const qRaw = deltaT > 0 ? 8.92 * Math.pow(deltaT, 1.1) : 0
  return [
    `t_ср_ТП = (${tSupply} + ${tReturn})/2 = ${tMean.toFixed(1)} °C`,
    `Δt_ТП = t_ср_ТП − t_вн = ${tMean.toFixed(1)} − ${tRoom} = ${deltaT.toFixed(1)} °C`,
    `q_raw = 8.92·Δt^1.1 = 8.92·${deltaT.toFixed(1)}^1.1 = ${qRaw.toFixed(1)} Вт/м²`,
    `q = q_raw·k_покр = ${qRaw.toFixed(1)}·${kCov.toFixed(2)} = ${qPerM2.toFixed(1)} Вт/м²`,
    `Q_тп = q·F_тп = ${qPerM2.toFixed(1)}·${areaM2.toFixed(1)} = ${totalQ.toFixed(0)} Вт`,
    `t_пол_ср = t_вн + q/α_tot = ${tRoom} + ${qPerM2.toFixed(1)}/${ALPHA_FLOOR_TOTAL} = ${floorT.toFixed(1)} °C`,
    `L_контура = F·100/шаг + 2·L_подв = ${areaM2.toFixed(1)}·100/${stepCm} + 6 = ${loopLength.toFixed(1)} м`,
    `N_контуров = ceil(L/L_max) = ${loopCount}`,
  ].join('\n')
}
