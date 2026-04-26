/**
 * Climate parameters card: city selector, read-only fields, tvn input, and Delta-t display.
 * Primary focal point: highlighted Delta-t value.
 * "+ Город" button opens CityFormDialog to add custom cities.
 */

import { useState, type ReactNode } from 'react'
import { CitySelector } from './CitySelector'
import { CityFormDialog } from './CityFormDialog'
import { TemperatureInput } from './TemperatureInput'
import { Button } from '../ui/Button'
import { useProjectStore, selectDeltaT } from '../../store/projectStore'
import { ColumnHint } from '../ColumnHint'
import { CLIMATE_NORM_REF } from '../../data/cities'

const ZONE_COLORS: Record<string, string> = {
  '\u0410': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  '\u0411': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  '\u0412': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
}

function ReadOnlyField({ label, value, mono = false }: { label: ReactNode; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} text-[var(--color-text-primary)]`}>
        {value}
      </span>
    </div>
  )
}

export function ClimateCard() {
  const city = useProjectStore(s => s.city)
  const deltaT = useProjectStore(selectDeltaT)
  const [showAddCity, setShowAddCity] = useState(false)

  const zoneBadgeClass = city
    ? ZONE_COLORS[city.humidityZone] ?? 'bg-gray-100 text-gray-800'
    : ''

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
        Параметры проекта
      </h2>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-x-6 gap-y-3">
        {/* City selector */}
        <div className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-secondary)]">Город</span>
          <div className="flex items-start gap-2">
            <CitySelector />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddCity(true)}
              title="Добавить пользовательский город"
            >
              + Город
            </Button>
          </div>
        </div>

        {/* tnar - read-only */}
        <ReadOnlyField
          label={<ColumnHint label={<>t<sub>нар</sub></>} hint="Расчётная температура наружного воздуха наиболее холодной пятидневки обеспеченностью 0.92 по СП 131.13330.2025. Берётся из справочника города." />}
          value={city ? `${city.tOutside}\u00B0C` : '\u2014'}
          mono
        />

        {/* GSOP - read-only */}
        <ReadOnlyField
          label={<ColumnHint label="ГСОП" hint="Градусо-сутки отопительного периода. Интегральная характеристика климата: ГСОП = (tвн − tот)·zот. Нужна для нормирования сопротивления теплопередаче ограждений." />}
          value={city ? String(city.gsop) : '\u2014'}
          mono
        />

        {/* Humidity zone - badge */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-secondary)]">
            <ColumnHint label="Зона влажности" hint="Зона влажности района строительства по СП 131.13330.2025 Приложение В: А (сухая), Б (нормальная), В (влажная). Влияет на условия эксплуатации ограждений и выбор утеплителя." />
          </span>
          {city ? (
            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium w-fit ${zoneBadgeClass}`}>
              {city.humidityZone}
            </span>
          ) : (
            <span className="text-sm text-[var(--color-text-primary)]">{'\u2014'}</span>
          )}
        </div>

        {/* tvn - editable */}
        <TemperatureInput />

        {/* Delta-t - HIGHLIGHTED */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--color-text-secondary)]">
            <ColumnHint label="Δt" hint="Расчётная разность температур Δt = tвн − tнар. Основной драйвер формулы теплопотерь Q = K·A·Δt·n. Чем больше Δt — тем мощнее должны быть приборы." />
          </span>
          <span className="inline-flex items-center rounded px-2 py-1 font-semibold font-mono text-sm bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            {deltaT !== null ? `${deltaT}\u00B0C` : '\u2014'}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
        Источник климатических данных: <span className="font-medium">{CLIMATE_NORM_REF}</span>
        <span className="opacity-70"> · tн.о. (обеспеч. 0,92), ГСОП и зона влажности — Таблица 3.1 и Приложение В</span>
      </div>

      <CityFormDialog
        open={showAddCity}
        onClose={() => setShowAddCity(false)}
      />
    </div>
  )
}
