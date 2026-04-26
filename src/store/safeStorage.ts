/**
 * Safe localStorage wrapper with QuotaExceededError handling.
 * Wraps all localStorage operations in try/catch to prevent
 * unhandled exceptions when storage is full or unavailable.
 */

import { toast } from 'sonner'
import type { StateStorage } from 'zustand/middleware'

export const safeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        toast.warning('Хранилище заполнено. Экспортируйте проект в JSON-файл.')
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name)
    } catch {
      // silently ignore — removal failure is non-critical
    }
  }
}

/**
 * Phase 04.2 RCA helper: validates persisted state shape on rehydrate.
 *
 * Persisted localStorage may contain fields with wrong types (e.g. `null` instead
 * of `[]` due to historical bugs), or be entirely non-object (corrupted JSON,
 * external write). Default zustand-persist merge happily copies garbage into
 * state, breaking downstream `.length` / `.map` calls.
 *
 * Use as `merge:` in persist config. `shape` declares expected type per field —
 * fields that fail validation fall back to the current (default-initialized) value.
 */
export type PersistFieldType = 'array-of-string' | 'record'

export function shapeMerge<T extends object>(
  persisted: unknown,
  current: T,
  shape: { readonly [K in keyof T]?: PersistFieldType }
): T {
  if (typeof persisted !== 'object' || persisted === null) return current
  const p = persisted as Record<string, unknown>
  const out = { ...current } as Record<string, unknown>
  for (const key of Object.keys(shape)) {
    const v = p[key]
    const t = shape[key as keyof T]
    if (t === 'array-of-string') {
      out[key] = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : (current as Record<string, unknown>)[key]
    } else if (t === 'record') {
      out[key] = (typeof v === 'object' && v !== null && !Array.isArray(v))
        ? v
        : (current as Record<string, unknown>)[key]
    }
  }
  // Copy over any persisted fields not declared in shape, unchanged
  for (const key of Object.keys(p)) {
    if (!(key in shape)) out[key] = p[key]
  }
  return out as T
}
