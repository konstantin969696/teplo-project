/** Darcy-Weisbach pressure loss per СП 60.13330.2020, формула Альтшуля. Pure TS — safe for Web Worker. */

/**
 * Коэффициент трения по Альтшулю (турбулентный режим, Re ≥ 2300).
 * λ = 0.11·(Δ_э/d + 68/Re)^0.25
 * @param re - число Рейнольдса (безразмерное)
 * @param roughnessMm - эквивалентная шероховатость Δ_э, мм
 * @param diameterMm - внутренний диаметр, мм
 */
export function altschulFriction(re: number, roughnessMm: number, diameterMm: number): number {
  if (re < 0.001) return 0
  if (diameterMm <= 0) return 0
  const delta_d = roughnessMm / diameterMm
  return 0.11 * Math.pow(delta_d + 68 / re, 0.25)
}

/**
 * Коэффициент трения: ламинар Re<2300 → 64/Re; турбулент → Альтшуль.
 * Guard: при Re < 0.001 возвращает 0 (пустой участок, нет течения).
 */
export function frictionFactor(re: number, roughnessMm: number, diameterMm: number): number {
  if (re < 0.001) return 0
  if (diameterMm <= 0) return 0
  if (re < 2300) return 64 / re
  return altschulFriction(re, roughnessMm, diameterMm)
}

/**
 * Линейные потери давления: ΔP_лин = λ·L/d·ρ·v²/2.
 * @param lambda - коэффициент трения (безразмерный)
 * @param lengthM - длина трубы, м
 * @param diameterM - внутренний диаметр, м (в СИ!)
 * @param rhoKgM3 - плотность теплоносителя, кг/м³
 * @param velocityMS - скорость теплоносителя, м/с
 */
export function pressureLossLinear(
  lambda: number,
  lengthM: number,
  diameterM: number,
  rhoKgM3: number,
  velocityMS: number
): number {
  if (diameterM <= 0) return 0
  if (lambda <= 0 || lengthM <= 0 || rhoKgM3 <= 0 || velocityMS <= 0) return 0
  return (lambda * lengthM / diameterM) * rhoKgM3 * velocityMS * velocityMS / 2
}

/**
 * Местные потери давления: ΔP_мест = Σζ·ρ·v²/2.
 * @param sumZeta - сумма коэффициентов местного сопротивления
 * @param rhoKgM3 - плотность теплоносителя, кг/м³
 * @param velocityMS - скорость теплоносителя, м/с
 */
export function pressureLossLocal(sumZeta: number, rhoKgM3: number, velocityMS: number): number {
  if (sumZeta <= 0 || rhoKgM3 <= 0 || velocityMS <= 0) return 0
  return sumZeta * rhoKgM3 * velocityMS * velocityMS / 2
}

/**
 * Строка аудита для коэффициента трения (различает ламинар/турбулент).
 */
export function buildFrictionAuditString(
  re: number,
  roughnessMm: number,
  diameterMm: number,
  lambda: number
): string {
  if (re < 2300) {
    return [
      'λ = 64/Re (ламинарный режим)',
      `   = 64/${re.toFixed(0)}`,
      `   = ${lambda.toFixed(4)}`,
    ].join('\n')
  }
  const delta_d = roughnessMm / diameterMm
  return [
    'λ = 0.11·(Δ/d + 68/Re)^0.25  (Альтшуль)',
    `   = 0.11·(${roughnessMm}/${diameterMm} + 68/${re.toFixed(0)})^0.25`,
    `   = 0.11·(${delta_d.toExponential(2)} + ${(68 / re).toExponential(2)})^0.25`,
    `   = ${lambda.toFixed(4)}`,
  ].join('\n')
}

/**
 * Строка аудита для потерь давления (линейные + местные).
 * @param lambda - коэффициент трения
 * @param lengthM - длина участка, м
 * @param diameterM - внутренний диаметр, м
 * @param rhoKgM3 - плотность, кг/м³
 * @param velocityMS - скорость, м/с
 * @param sumZeta - сумма КМС
 * @param dpLinear - линейные потери, Па
 * @param dpLocal - местные потери, Па
 */
export function buildPressureLossAuditString(
  lambda: number,
  lengthM: number,
  diameterM: number,
  rhoKgM3: number,
  velocityMS: number,
  sumZeta: number,
  dpLinear: number,
  dpLocal: number
): string {
  const dMm = (diameterM * 1000).toFixed(0)
  return [
    'ΔP_лин = λ·L/d·ρ·v²/2',
    `   = ${lambda.toFixed(4)}·${lengthM.toFixed(1)}/${dMm}мм·${rhoKgM3.toFixed(0)}·${velocityMS.toFixed(3)}²/2`,
    `   = ${dpLinear.toFixed(0)} Па`,
    'ΔP_мест = Σζ·ρ·v²/2',
    `   = ${sumZeta.toFixed(2)}·${rhoKgM3.toFixed(0)}·${velocityMS.toFixed(3)}²/2`,
    `   = ${dpLocal.toFixed(0)} Па`,
    `ΔP_итого = ${dpLinear.toFixed(0)} + ${dpLocal.toFixed(0)} = ${(dpLinear + dpLocal).toFixed(0)} Па`,
  ].join('\n')
}
