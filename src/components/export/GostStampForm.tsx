/**
 * Форма ввода параметров основной надписи для текстовых документов
 * (ГОСТ Р 21.101-2020 форма 5/6). Используется внутри PreviewModal
 * когда выбран режим "Текстовый документ".
 *
 * Обязательные поля: objectCode, stageCode, authorName.
 * Валидация: только подсветка — экспорт не блокируется (SPEC не требует).
 */

import type { GostStampParams } from '../../export/types'

interface GostStampFormProps {
  readonly stamp: GostStampParams
  readonly onChange: <K extends keyof GostStampParams>(key: K, value: GostStampParams[K]) => void
  readonly onReset: () => void
}

const FIELD_CLASS = 'w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-sm'
const REQUIRED_FIELD_CLASS = (val: string) =>
  `${FIELD_CLASS} ${val.trim() === '' ? 'border-[var(--color-warning)]' : ''}`

export function GostStampForm({ stamp, onChange, onReset }: GostStampFormProps) {
  const f = <K extends keyof GostStampParams>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange(key, e.target.value as GostStampParams[K])

  return (
    <div className="space-y-2">
      <Field label="Название документа">
        <input
          value={stamp.drawingTitle}
          onChange={f('drawingTitle')}
          placeholder="Расчёт теплопотерь"
          aria-label="Название документа"
          className={FIELD_CLASS}
        />
      </Field>

      <Field label="Марка/шифр документа" hint="опц.">
        <input
          value={stamp.drawingMark}
          onChange={f('drawingMark')}
          placeholder="70-2025-П-ИЛО - ОВ"
          aria-label="Марка чертежа"
          className={FIELD_CLASS}
        />
      </Field>

      <hr className="my-2 border-[var(--color-border)]" />

      <Field label="Объект">
        <input
          value={stamp.objectName}
          onChange={f('objectName')}
          placeholder="Жилой дом по адресу..."
          aria-label="Наименование объекта"
          className={FIELD_CLASS}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Шифр объекта" required>
          <input
            value={stamp.objectCode}
            onChange={f('objectCode')}
            placeholder="70-2025"
            aria-label="Шифр объекта"
            className={REQUIRED_FIELD_CLASS(stamp.objectCode)}
          />
        </Field>
        <Field label="Подраздел">
          <input
            value={stamp.subsectionCode}
            onChange={f('subsectionCode')}
            placeholder="ИЛО"
            aria-label="Подраздел"
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Марка">
          <input
            value={stamp.markCode}
            onChange={f('markCode')}
            placeholder="ОВ"
            aria-label="Марка комплекта"
            className={FIELD_CLASS}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Стадия" required>
          <select
            value={stamp.stageCode}
            onChange={f('stageCode')}
            aria-label="Стадия"
            className={FIELD_CLASS}
          >
            <option value="П">П</option>
            <option value="Р">Р</option>
            <option value="РД">РД</option>
            <option value="Э">Э</option>
          </select>
        </Field>
        <Field label="Дата">
          <input
            type="date"
            value={stamp.date}
            onChange={f('date')}
            aria-label="Дата"
            className={FIELD_CLASS}
          />
        </Field>
      </div>

      <hr className="my-2 border-[var(--color-border)]" />

      <Field label="Разработал" required>
        <input
          value={stamp.authorName}
          onChange={f('authorName')}
          aria-label="Разработал"
          className={REQUIRED_FIELD_CLASS(stamp.authorName)}
        />
      </Field>
      <Field label="Проверил">
        <input value={stamp.checkerName} onChange={f('checkerName')} aria-label="Проверил" className={FIELD_CLASS} />
      </Field>
      <Field label="ГИП">
        <input value={stamp.gipName} onChange={f('gipName')} aria-label="ГИП" className={FIELD_CLASS} />
      </Field>
      <Field label="Н. контроль">
        <input value={stamp.normControlName} onChange={f('normControlName')} aria-label="Н. контроль" className={FIELD_CLASS} />
      </Field>
      <Field label="Утвердил" hint="опц.">
        <input value={stamp.approverName} onChange={f('approverName')} aria-label="Утвердил" className={FIELD_CLASS} />
      </Field>

      <hr className="my-2 border-[var(--color-border)]" />

      <Field label="Организация">
        <input value={stamp.companyName} onChange={f('companyName')} aria-label="Организация" className={FIELD_CLASS} />
      </Field>
      <Field label="Подразделение">
        <input value={stamp.companyDept} onChange={f('companyDept')} aria-label="Подразделение" className={FIELD_CLASS} />
      </Field>

      <button
        onClick={onReset}
        className="text-xs text-[var(--color-text-secondary)] underline mt-1"
      >
        сбросить параметры штампа
      </button>

      {(stamp.objectCode.trim() === '' || stamp.authorName.trim() === '') && (
        <p className="text-[11px] text-[var(--color-warning)]">
          Обязательные поля: Шифр объекта, Разработал
        </p>
      )}
    </div>
  )
}

function Field({ label, hint, required, children }: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-[var(--color-text-secondary)] mb-0.5">
        {label}
        {required && <span className="text-[var(--color-warning)] ml-0.5">*</span>}
        {hint ? <span className="opacity-70"> ({hint})</span> : null}
      </div>
      {children}
    </label>
  )
}
