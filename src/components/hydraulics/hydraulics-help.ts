/**
 * Shared UI helpers for Phase 4 hydraulics components.
 * Re-exports INPUT_CLASS from equipment-help (DRY).
 * Houses label maps and format helpers for hydraulics UI.
 */

export { INPUT_CLASS } from '../equipment/equipment-help'

export const SCHEMA_LABELS: Record<string, string> = {
  'two-pipe-dead-end': '2-труб тупиковая',
  'two-pipe-flow-through': '2-труб попутная',
  'manifold': 'Лучевая',
  'single-pipe': 'Однотрубная',
}

export const PIPE_MATERIAL_LABELS: Record<string, string> = {
  'steel-vgp': 'Сталь ВГП',
  'copper': 'Медь',
  'pe-x': 'PE-X',
  'pe-rt': 'PE-RT',
  'mlcp': 'Металлопластик',
  'ppr': 'PPR',
}

export function formatDeltaP(pa: number): string {
  if (!Number.isFinite(pa) || pa === 0) return '—'
  return pa.toFixed(0)
}

export function formatFlow(kgH: number): string {
  if (!Number.isFinite(kgH) || kgH === 0) return '—'
  return kgH.toFixed(1)
}

export function formatVelocity(ms: number): string {
  if (!Number.isFinite(ms) || ms === 0) return '—'
  return ms.toFixed(2)
}

export function formatDiameter(mm: number | null): string {
  if (mm === null || !Number.isFinite(mm) || mm <= 0) return '—'
  return mm.toFixed(1)
}
