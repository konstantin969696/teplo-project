/**
 * Number input for indoor temperature (tvn).
 * Reads/writes tInside from project store.
 * Validates range 10-60 with visual feedback.
 */

import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { ColumnHint } from '../ColumnHint'

const MIN_TEMP = 10
const MAX_TEMP = 60

export function TemperatureInput() {
  const tInside = useProjectStore(s => s.tInside)
  const setTInside = useProjectStore(s => s.setTInside)
  const [localValue, setLocalValue] = useState(String(tInside))

  const numericValue = Number(localValue)
  const isOutOfRange = localValue !== '' && (isNaN(numericValue) || numericValue < MIN_TEMP || numericValue > MAX_TEMP)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setLocalValue(raw)
    const parsed = Number(raw)
    if (!isNaN(parsed)) {
      setTInside(parsed)
    }
  }

  const handleBlur = () => {
    setLocalValue(String(tInside))
  }

  const borderClass = isOutOfRange
    ? 'border-[var(--color-destructive)] ring-1 ring-[var(--color-destructive)]'
    : 'border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--color-text-secondary)]">
        <ColumnHint label={<>t<sub>вн</sub></>} hint="Расчётная температура внутреннего воздуха — глобальный дефолт для всех помещений. Обычно 20°C для жилых помещений. Для конкретной комнаты можно переопределить в таблице." />
      </label>
      <div className="relative flex items-center gap-1">
        <input
          type="number"
          min={MIN_TEMP}
          max={MAX_TEMP}
          step={1}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-20 rounded-md px-3 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-primary)] outline-none transition-colors ${borderClass}`}
          aria-label="Температура внутреннего воздуха"
          aria-invalid={isOutOfRange}
        />
        <span className="text-xs text-[var(--color-text-secondary)]">
          {'\u00B0C'}
        </span>
      </div>
      {isOutOfRange && (
        <span className="text-xs text-[var(--color-destructive)]" role="alert">
          {`Температура вне диапазона ${MIN_TEMP}\u2013${MAX_TEMP}\u00B0C`}
        </span>
      )}
    </div>
  )
}
