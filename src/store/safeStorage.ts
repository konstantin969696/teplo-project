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
