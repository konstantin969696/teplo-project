/**
 * Modal dialog for creating or editing a custom city.
 * Create mode: editCity is null/undefined — opens with empty fields.
 * Edit mode: editCity is provided — form is pre-filled.
 * Validates on submit (not on blur). Auto-focuses name input on open.
 */

import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/Button'
import { useProjectStore } from '../../store/projectStore'
import type { CustomCityData } from '../../types/project'

interface CityFormDialogProps {
  open: boolean
  onClose: () => void
  editCity?: CustomCityData | null
}

interface FormErrors {
  name?: string
  tOutside?: string
  gsop?: string
  humidityZone?: string
}

const HUMIDITY_ZONES = ['А', 'Б', 'В'] as const

export function CityFormDialog({ open, onClose, editCity }: CityFormDialogProps) {
  const [name, setName] = useState('')
  const [tOutside, setTOutside] = useState('')
  const [gsop, setGsop] = useState('')
  const [humidityZone, setHumidityZone] = useState<'А' | 'Б' | 'В'>('Б')
  const [errors, setErrors] = useState<FormErrors>({})

  const nameRef = useRef<HTMLInputElement>(null)

  const isEditMode = !!editCity

  // Initialize form fields when dialog opens or editCity changes
  useEffect(() => {
    if (!open) return
    if (editCity) {
      setName(editCity.name)
      setTOutside(String(editCity.tOutside))
      setGsop(String(editCity.gsop))
      setHumidityZone(editCity.humidityZone)
    } else {
      setName('')
      setTOutside('')
      setGsop('')
      setHumidityZone('Б')
    }
    setErrors({})
  }, [open, editCity])

  // Auto-focus name input on open
  useEffect(() => {
    if (open) {
      // Small delay to ensure the DOM is ready
      const t = setTimeout(() => nameRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Escape key closes dialog
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!name.trim()) {
      newErrors.name = 'Введите название города'
    }

    const tNum = Number(tOutside)
    if (tOutside.trim() === '' || !Number.isFinite(tNum)) {
      newErrors.tOutside = 'Введите корректную температуру'
    }

    const gsopNum = Number(gsop)
    if (gsop.trim() === '' || !Number.isFinite(gsopNum)) {
      newErrors.gsop = 'Введите корректное значение ГСОП'
    }

    if (!HUMIDITY_ZONES.includes(humidityZone)) {
      newErrors.humidityZone = 'Выберите зону влажности'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const cityData = {
      name: name.trim(),
      tOutside: Number(tOutside),
      gsop: Number(gsop),
      humidityZone
    }

    if (isEditMode && editCity) {
      useProjectStore.getState().updateCustomCity(editCity.id, cityData)
    } else {
      useProjectStore.getState().addCustomCity(cityData)
    }

    onClose()
  }

  if (!open) return null

  const inputClass = 'w-full border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="city-form-dialog-title"
    >
      <div
        className="max-w-sm w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3
          id="city-form-dialog-title"
          className="text-base font-semibold text-[var(--color-text-primary)] mb-4"
        >
          {isEditMode ? 'Редактировать город' : 'Добавить город'}
        </h3>

        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4">
            {/* Name field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-secondary)]" htmlFor="city-form-name">
                Название города
              </label>
              <input
                ref={nameRef}
                id="city-form-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Например: Мой посёлок"
                className={inputClass}
                required
              />
              {errors.name && (
                <span className="text-xs text-[var(--color-destructive)]">{errors.name}</span>
              )}
            </div>

            {/* tOutside field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-secondary)]" htmlFor="city-form-toutside">
                t&#8345;&#8345;&#8339; (°C)
              </label>
              <input
                id="city-form-toutside"
                type="number"
                value={tOutside}
                onChange={e => setTOutside(e.target.value)}
                step="1"
                className={inputClass}
                required
              />
              {errors.tOutside && (
                <span className="text-xs text-[var(--color-destructive)]">{errors.tOutside}</span>
              )}
            </div>

            {/* GSOP field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-secondary)]" htmlFor="city-form-gsop">
                ГСОП
              </label>
              <input
                id="city-form-gsop"
                type="number"
                value={gsop}
                onChange={e => setGsop(e.target.value)}
                step="1"
                min="0"
                className={inputClass}
                required
              />
              {errors.gsop && (
                <span className="text-xs text-[var(--color-destructive)]">{errors.gsop}</span>
              )}
            </div>

            {/* humidityZone field */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-secondary)]" htmlFor="city-form-humidity">
                Зона влажности
              </label>
              <select
                id="city-form-humidity"
                value={humidityZone}
                onChange={e => setHumidityZone(e.target.value as 'А' | 'Б' | 'В')}
                className={inputClass}
              >
                {HUMIDITY_ZONES.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
              {errors.humidityZone && (
                <span className="text-xs text-[var(--color-destructive)]">{errors.humidityZone}</span>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
            >
              Сохранить
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
