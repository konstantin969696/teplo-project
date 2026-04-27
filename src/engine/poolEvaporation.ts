/**
 * Pool evaporation heat loss calculations per VDI 2089 / ГОСТ Р 72128-2025.
 * Pure functions, zero React imports.
 */

import type { PoolMode, PoolParams } from '../types/project'

/**
 * POOL-05: β by operating mode [кг/(м²·ч·кПа)].
 * Source: VDI 2089, ε [г/(м²·ч·мбар)] / 100 = β [кг/(м²·ч·кПа)].
 */
export const BETA_BY_MODE: Record<PoolMode, number> = {
  active:  0.20,  // ε=20 (общественный бассейн, нормальная нагрузка)
  idle:    0.05,  // ε=5  (покой, открытое зеркало)
  covered: 0.005, // ε=0.5 (покрытие / плёнка)
}

/**
 * POOL-01: Saturated vapor pressure via Magnus formula [кПа].
 *
 * P_нас(T) = 0.6108 · exp(17.27 · T / (T + 237.3))
 *
 * Valid 0–60 °C, error < 0.5 %.
 */
export function calculateSaturatedVaporPressure(t: number): number {
  return 0.6108 * Math.exp((17.27 * t) / (t + 237.3))
}

/**
 * POOL-02: Partial vapor pressure in room air [кПа].
 *
 * P_парц = P_нас(tAir) · φ
 */
export function calculatePartialVaporPressure(tAir: number, phi: number): number {
  return calculateSaturatedVaporPressure(tAir) * phi
}

/**
 * POOL-03: Evaporation mass rate [кг/ч].
 *
 * G_исп = β · (P_нас(tWater) − P_парц(tAir, φ)) · F_зерк
 * Clamped to ≥ 0 — negative evaporation is physically impossible.
 */
export function calculateEvaporationMass(
  beta: number,
  pSat: number,
  pPartial: number,
  fMirrorM2: number
): number {
  if (beta <= 0 || fMirrorM2 <= 0) return 0
  return Math.max(0, beta * (pSat - pPartial) * fMirrorM2)
}

/**
 * POOL-04: Evaporation heat loss [Вт].
 *
 * Q_исп = G_исп · r · 1000 / 3600
 * r = 2450 кДж/кг (latent heat of vaporization, constant for 20–35 °C range)
 */
export function calculateEvaporationHeatW(evaporationMassKgH: number): number {
  return evaporationMassKgH * 2450 * 1000 / 3600
}

/**
 * POOL-06: Full Q_исп for a room with a pool [Вт].
 * Returns 0 if pool is disabled or undefined.
 */
export function calculatePoolEvaporationHeat(
  pool: PoolParams | undefined,
  tAir: number
): number {
  if (!pool?.enabled) return 0
  if (!Number.isFinite(pool.tWaterC) || !Number.isFinite(pool.phi) || !Number.isFinite(pool.fMirrorM2)) return 0
  const beta = BETA_BY_MODE[pool.mode]
  const pSat = calculateSaturatedVaporPressure(pool.tWaterC)
  const pPartial = calculatePartialVaporPressure(tAir, pool.phi)
  const g = calculateEvaporationMass(beta, pSat, pPartial, pool.fMirrorM2)
  return calculateEvaporationHeatW(g)
}
