/**
 * Pure climate calculation functions.
 * Zero React imports — safe for Web Worker usage in Phase 6.
 */

/** Calculate temperature difference between indoor and outdoor. */
export function calculateDeltaT(tInside: number, tOutside: number): number {
  return tInside - tOutside
}

/** Clamp temperature value to a valid range. Default: [10, 60] for tInside. */
export function clampTemperature(value: number, min: number = 10, max: number = 60): number {
  return Math.max(min, Math.min(max, value))
}
