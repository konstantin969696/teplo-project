/**
 * Phase 06 — persistent store for export settings.
 * Holds user-fillable stamp values, default sheet format & orientation.
 * Persist key: 'teplo-export'.
 *
 * shapeMerge invariant follows Phase 04.2 pattern: invalid persisted shape
 * falls back to defaults. См. `safeStorage.shapeMerge`.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage, shapeMerge } from '../../store/safeStorage'
import { EMPTY_STAMP } from '../sheet/stamp'
import type { Stamp, Orientation, ExportFontFamily, StampMode } from '../types'

export interface ExportState {
  readonly stamp: Stamp
  readonly defaultFormatId: string
  readonly defaultOrientation: Orientation
  readonly fontFamily: ExportFontFamily
  readonly defaultStampMode: StampMode
  readonly defaultFooterLine: string
  setStampField: <K extends keyof Stamp>(key: K, value: Stamp[K]) => void
  setStamp: (stamp: Stamp) => void
  setDefaultFormat: (id: string) => void
  setDefaultOrientation: (o: Orientation) => void
  setFontFamily: (f: ExportFontFamily) => void
  setDefaultStampMode: (m: StampMode) => void
  setDefaultFooterLine: (s: string) => void
  resetStamp: () => void
}

const initialState = {
  stamp: EMPTY_STAMP,
  defaultFormatId: 'A4',
  defaultOrientation: 'portrait' as Orientation,
  fontFamily: 'roboto' as ExportFontFamily,
  defaultStampMode: 'full' as StampMode,
  defaultFooterLine: ''
}

/**
 * Phase 07.1: при апгрейде с v1 (без objectCode/subsectionCode/gipName/...) подмешиваем
 * дефолтные значения новых полей. shapeMerge сохранит существующие значения.
 */
function mergeStamp(persistedStamp: unknown): Stamp {
  if (typeof persistedStamp !== 'object' || persistedStamp === null) return EMPTY_STAMP
  const p = persistedStamp as Partial<Stamp>
  return {
    ...EMPTY_STAMP,
    ...p
  }
}

export const useExportStore = create<ExportState>()(
  persist(
    (set) => ({
      ...initialState,

      setStampField: (key, value) => set(state => ({
        stamp: { ...state.stamp, [key]: value }
      })),
      setStamp: (stamp) => set({ stamp }),
      setDefaultFormat: (id) => set({ defaultFormatId: id }),
      setDefaultOrientation: (o) => set({ defaultOrientation: o }),
      setFontFamily: (f) => set({ fontFamily: f }),
      setDefaultStampMode: (m) => set({ defaultStampMode: m }),
      setDefaultFooterLine: (s) => set({ defaultFooterLine: s }),
      resetStamp: () => set({ stamp: EMPTY_STAMP })
    }),
    {
      name: 'teplo-export',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        stamp: state.stamp,
        defaultFormatId: state.defaultFormatId,
        defaultOrientation: state.defaultOrientation,
        fontFamily: state.fontFamily,
        defaultStampMode: state.defaultStampMode,
        defaultFooterLine: state.defaultFooterLine
      } as unknown as ExportState),
      merge: (persisted, current) => {
        const merged = shapeMerge(persisted, current as ExportState, {
          stamp: 'record'
        })
        // Дозаливаем новые поля Stamp из EMPTY_STAMP
        return { ...merged, stamp: mergeStamp(merged.stamp) }
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error('[exportStore] rehydration failed', error)
      }
    }
  )
)
