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
import type { Stamp, Orientation, ExportFontFamily } from '../types'

export interface ExportState {
  readonly stamp: Stamp
  readonly defaultFormatId: string
  readonly defaultOrientation: Orientation
  readonly fontFamily: ExportFontFamily
  setStampField: <K extends keyof Stamp>(key: K, value: Stamp[K]) => void
  setStamp: (stamp: Stamp) => void
  setDefaultFormat: (id: string) => void
  setDefaultOrientation: (o: Orientation) => void
  setFontFamily: (f: ExportFontFamily) => void
  resetStamp: () => void
}

const initialState = {
  stamp: EMPTY_STAMP,
  defaultFormatId: 'A4',
  defaultOrientation: 'portrait' as Orientation,
  fontFamily: 'roboto' as ExportFontFamily
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
      resetStamp: () => set({ stamp: EMPTY_STAMP })
    }),
    {
      name: 'teplo-export',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        stamp: state.stamp,
        defaultFormatId: state.defaultFormatId,
        defaultOrientation: state.defaultOrientation,
        fontFamily: state.fontFamily
      } as unknown as ExportState),
      // Phase 06: shapeMerge — stamp как 'record', строковые поля валидируем мягко.
      merge: (persisted, current) => shapeMerge(persisted, current as ExportState, {
        stamp: 'record'
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error('[exportStore] rehydration failed', error)
      }
    }
  )
)
