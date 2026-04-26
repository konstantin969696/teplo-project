/** Reynolds number per СП 60.13330.2020 / Альтшуль. Pure TS — safe for Web Worker. */

/**
 * Число Рейнольдса: Re = v·d/ν.
 * Guard: возвращает 0 при нулевых или невалидных входах.
 * @param velocityMS - скорость теплоносителя, м/с
 * @param diameterM - внутренний диаметр трубы, м
 * @param kinematicViscosityM2S - кинематическая вязкость ν, м²/с (в СИ, не ×10⁶)
 */
export function reynolds(velocityMS: number, diameterM: number, kinematicViscosityM2S: number): number {
  if (!Number.isFinite(velocityMS) || !Number.isFinite(diameterM) || !Number.isFinite(kinematicViscosityM2S)) return 0
  if (velocityMS <= 0 || diameterM <= 0 || kinematicViscosityM2S <= 0) return 0
  return (velocityMS * diameterM) / kinematicViscosityM2S
}

/**
 * Строка подстановки для аудита формулы Re.
 */
export function buildReynoldsAuditString(v: number, d: number, nu: number, re: number): string {
  return [
    'Re = v·d/ν',
    `   = ${v.toFixed(3)}·${d.toFixed(4)}/${nu.toExponential(2)}`,
    `   = ${re.toFixed(0)}`,
  ].join('\n')
}
