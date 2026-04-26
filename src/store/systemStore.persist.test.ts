/**
 * Phase 04.2 — RCA для systemOrder undefined.
 * Воспроизводим persist-rehydration scenarios БЕЗ `?? []` оберега в migration.ts —
 * убеждаемся что systemStore сам гарантирует валидный shape после rehydrate.
 *
 * Если эти тесты проходят — гипотеза H1 (partial persisted state) НЕ воспроизводит
 * "systemOrder undefined" на стороне store. Защита `?? []` в migration.ts тогда
 * избыточна, и можно её снять. Если падают — H1 подтверждена, нужен явный `merge:`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const PERSIST_KEY = 'teplo-systems'

async function freshSystemStore() {
  // Сбрасываем module-cache, чтобы persist прошёл заново на нашем seeded localStorage.
  const mod = await import('./systemStore')
  // На каждом import zustand persist синхронно гидрирует из localStorage.
  return mod.useSystemStore
}

beforeEach(() => {
  localStorage.clear()
  // vitest module-cache reset — ВАЖНО, иначе useSystemStore singleton
  // и состояние не перечитывается из localStorage.
  // @ts-expect-error vitest types
  if (typeof globalThis.__vitest_resetModules === 'function') {
    // noop placeholder, реальный reset через vi.resetModules ниже
  }
})

afterEach(() => {
  localStorage.clear()
})

describe('systemStore.persist — rehydration shape guarantees', () => {
  it('S0: пустой localStorage → systemOrder = []', async () => {
    const { default: vi } = await import('vitest').then(m => ({ default: m.vi }))
    vi.resetModules()
    const useSystemStore = await freshSystemStore()
    const state = useSystemStore.getState()
    expect(Array.isArray(state.systemOrder)).toBe(true)
    expect(state.systemOrder).toEqual([])
    expect(state.systems).toEqual({})
  })

  it('S1: persisted без поля systemOrder → systemOrder = []', async () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      state: { systems: {} },
      version: 1
    }))
    const { default: vi } = await import('vitest').then(m => ({ default: m.vi }))
    vi.resetModules()
    const useSystemStore = await freshSystemStore()
    const state = useSystemStore.getState()
    expect(Array.isArray(state.systemOrder)).toBe(true)
    expect(state.systemOrder).toEqual([])
  })

  it('S2: persisted.systemOrder = "not-an-array" → должен нормализоваться в []', async () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      state: { systems: {}, systemOrder: 'broken-string' as unknown as string[] },
      version: 1
    }))
    const { default: vi } = await import('vitest').then(m => ({ default: m.vi }))
    vi.resetModules()
    const useSystemStore = await freshSystemStore()
    const state = useSystemStore.getState()
    // Этот тест ОЖИДАЕМО упадёт без явного merge: zustand
    // запишет string в systemOrder as-is. Падение подтверждает что
    // нужен validator в persist-конфиге.
    expect(Array.isArray(state.systemOrder)).toBe(true)
    expect(state.systemOrder).toEqual([])
  })

  it('S3: невалидный JSON в localStorage → systemOrder = []', async () => {
    localStorage.setItem(PERSIST_KEY, '{not valid json')
    const { default: vi } = await import('vitest').then(m => ({ default: m.vi }))
    vi.resetModules()
    const useSystemStore = await freshSystemStore()
    const state = useSystemStore.getState()
    expect(Array.isArray(state.systemOrder)).toBe(true)
    expect(state.systemOrder).toEqual([])
  })

  it('S4: persisted.systems = null → systems = {}, systemOrder = []', async () => {
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      state: { systems: null, systemOrder: null },
      version: 1
    }))
    const { default: vi } = await import('vitest').then(m => ({ default: m.vi }))
    vi.resetModules()
    const useSystemStore = await freshSystemStore()
    const state = useSystemStore.getState()
    expect(state.systems).toEqual({})
    expect(state.systemOrder).toEqual([])
  })
})
