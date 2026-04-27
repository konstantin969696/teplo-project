/**
 * Phase 06 — preview modal: sheets thumbnail + nav + stamp form + format/orientation
 * + export buttons (stub on phase 06; реальный экспорт — фазы 07/08/09).
 */

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useExportStore } from '../store/exportStore'
import { SHEET_FORMATS, findFormat } from '../sheet/formats'
import { paginate } from '../sheet/layout'
import { SheetCanvas } from './SheetCanvas'
import { exportToPdf } from '../backends/pdf'
import { exportToExcel } from '../backends/excel'
import { exportToWord } from '../backends/word'
import { FONT_SOURCES } from '../backends/fontLoader'
import { GostStampForm } from '../../components/export/GostStampForm'
import type { DocumentModel, Stamp, Orientation, ExportFontFamily, StampMode } from '../types'

interface PreviewModalProps {
  readonly model: DocumentModel
  readonly onClose: () => void
}

export function PreviewModal({ model, onClose }: PreviewModalProps) {
  const stampStored = useExportStore(s => s.stamp)
  const setStampField = useExportStore(s => s.setStampField)
  const setStamp = useExportStore(s => s.setStamp)
  const gostStamp = useExportStore(s => s.gostStamp)
  const setGostStampField = useExportStore(s => s.setGostStampField)
  const resetGostStamp = useExportStore(s => s.resetGostStamp)
  const defaultFormatId = useExportStore(s => s.defaultFormatId)
  const setDefaultFormat = useExportStore(s => s.setDefaultFormat)
  const defaultOrientation = useExportStore(s => s.defaultOrientation)
  const setDefaultOrientation = useExportStore(s => s.setDefaultOrientation)
  const fontFamily = useExportStore(s => s.fontFamily)
  const setFontFamily = useExportStore(s => s.setFontFamily)
  const defaultStampMode = useExportStore(s => s.defaultStampMode)
  const setDefaultStampMode = useExportStore(s => s.setDefaultStampMode)
  const defaultFooterLine = useExportStore(s => s.defaultFooterLine)
  const setDefaultFooterLine = useExportStore(s => s.setDefaultFooterLine)

  const [sheetIdx, setSheetIdx] = useState(0)
  const [exportingFmt, setExportingFmt] = useState<'pdf' | 'excel' | 'word' | null>(null)
  const [stampType, setStampType] = useState<'form1' | 'gost'>('form1')

  // Применяем поля штампа: общие сохраняем в store, drawingTitle/drawingMark
  // приходят из model (per-document). Если пользователь меняет drawingTitle/Mark
  // в форме — обновим в state-локальной копии stamp, но НЕ в общем сторе
  // (чтобы при открытии другого таба не утаскивать "Спецификация приборов" в Теплопотери).
  const [perDocOverrides, setPerDocOverrides] = useState({
    drawingTitle: model.stamp.drawingTitle,
    drawingMark: model.stamp.drawingMark
  })

  const stamp: Stamp = {
    ...stampStored,
    drawingTitle: perDocOverrides.drawingTitle,
    drawingMark: perDocOverrides.drawingMark
  }

  const effectiveModel: DocumentModel = useMemo(() => ({
    ...model,
    format: findFormat(defaultFormatId) ?? model.format,
    orientation: defaultOrientation,
    stamp,
    stampMode: defaultStampMode,
    footerLine: defaultFooterLine,
    gostStamp: stampType === 'gost' ? gostStamp : undefined,
  }), [model, defaultFormatId, defaultOrientation, stamp, defaultStampMode, defaultFooterLine, stampType, gostStamp])

  const sheets = useMemo(() => paginate(effectiveModel), [effectiveModel])
  const currentSheet = sheets[Math.min(sheetIdx, Math.max(0, sheets.length - 1))]
  if (!currentSheet) {
    return null
  }

  const handleExportPdf = async () => {
    if (exportingFmt != null) return
    setExportingFmt('pdf')
    try {
      const blob = await exportToPdf(effectiveModel, { fontFamily })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${effectiveModel.fileName}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Дать браузеру шанс начать скачивание перед revoke
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('PDF готов')
    } catch (err) {
      console.error('[export] PDF failed', err)
      toast.error(`Ошибка экспорта PDF: ${err instanceof Error ? err.message : 'неизвестная'}`)
    } finally {
      setExportingFmt(null)
    }
  }

  const handleExportExcel = async () => {
    if (exportingFmt != null) return
    setExportingFmt('excel')
    try {
      const blob = await exportToExcel(effectiveModel)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${effectiveModel.fileName}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Excel готов')
    } catch (err) {
      console.error('[export] Excel failed', err)
      toast.error(`Ошибка экспорта Excel: ${err instanceof Error ? err.message : 'неизвестная'}`)
    } finally {
      setExportingFmt(null)
    }
  }

  const handleExportWord = async () => {
    if (exportingFmt != null) return
    setExportingFmt('word')
    try {
      const blob = await exportToWord(effectiveModel)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${effectiveModel.fileName}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Word готов')
    } catch (err) {
      console.error('[export] Word failed', err)
      toast.error(`Ошибка экспорта Word: ${err instanceof Error ? err.message : 'неизвестная'}`)
    } finally {
      setExportingFmt(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/50">
      {/* Боковая панель: настройки экспорта */}
      <aside className="w-[360px] bg-[var(--color-bg)] border-r border-[var(--color-border)] flex flex-col overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold">Экспорт</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-surface)]"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <Section title="Формат листа">
            <select
              value={defaultFormatId}
              onChange={e => setDefaultFormat(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              {SHEET_FORMATS.map(f => (
                <option key={f.id} value={f.id}>{f.label} — {f.widthMm}×{f.heightMm} мм</option>
              ))}
            </select>
            {defaultFormatId === 'A3x3' && (
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                А3×3 рекомендуется для спецификаций более 50 позиций.
              </p>
            )}
          </Section>

          <Section title="Ориентация">
            <div className="flex gap-2">
              {(['portrait', 'landscape'] as Orientation[]).map(o => {
                const fmt = findFormat(defaultFormatId)
                const disabled = fmt != null && !fmt.canRotate
                return (
                  <button
                    key={o}
                    disabled={disabled}
                    onClick={() => setDefaultOrientation(o)}
                    className={`flex-1 px-2 py-1.5 rounded border text-sm
                      ${defaultOrientation === o
                        ? 'bg-[var(--color-accent,#3b82f6)] text-white border-transparent'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)]'}
                      ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {o === 'portrait' ? 'Книжная' : 'Альбомная'}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Шрифт PDF">
            <select
              value={fontFamily}
              onChange={e => setFontFamily(e.target.value as ExportFontFamily)}
              className="w-full px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              {(Object.entries(FONT_SOURCES) as [ExportFontFamily, typeof FONT_SOURCES[ExportFontFamily]][]).map(([id, src]) => (
                <option key={id} value={id}>{src.label}</option>
              ))}
            </select>
          </Section>

          <Section title="Режим оформления листа">
            <div className="space-y-1">
              {([
                { id: 'full', label: 'Полный штамп ГОСТ' },
                { id: 'minimal-footer', label: 'Только нижняя строка' },
                { id: 'none', label: 'Без штампа (только рамка)' }
              ] as { id: StampMode; label: string }[]).map(opt => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="stampMode"
                    value={opt.id}
                    checked={defaultStampMode === opt.id}
                    onChange={() => setDefaultStampMode(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {defaultStampMode === 'minimal-footer' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={defaultFooterLine}
                  onChange={e => setDefaultFooterLine(e.target.value)}
                  placeholder="Например: Приложение Б"
                  className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              </div>
            )}
          </Section>

          <Section title="Тип штампа">
            <div className="flex gap-2">
              {([
                { id: 'form1', label: 'Чертёж (форма 1)' },
                { id: 'gost', label: 'Текстовый документ (форма 5/6)' }
              ] as { id: 'form1' | 'gost'; label: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setStampType(opt.id)}
                  aria-pressed={stampType === opt.id}
                  className={`flex-1 px-2 py-1.5 rounded border text-xs
                    ${stampType === opt.id
                      ? 'bg-[var(--color-accent,#3b82f6)] text-white border-transparent'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          {stampType === 'form1' && defaultStampMode === 'full' && (
            <Section title="Параметры штампа">
              <StampForm
                stamp={stamp}
                onCommonChange={(k, v) => setStampField(k, v as Stamp[typeof k])}
                onPerDocChange={(k, v) => setPerDocOverrides(p => ({ ...p, [k]: v }))}
                onResetPerDoc={() => setPerDocOverrides({
                  drawingTitle: model.stamp.drawingTitle,
                  drawingMark: model.stamp.drawingMark
                })}
                onApplyAll={() => setStamp(stamp)}
                onLogoChange={dataUrl => setStampField('logoDataUrl', dataUrl)}
              />
            </Section>
          )}

          {stampType === 'gost' && (
            <Section title="Параметры штампа (форма 5/6)">
              <GostStampForm
                stamp={gostStamp}
                onChange={(k, v) => setGostStampField(k, v)}
                onReset={resetGostStamp}
              />
            </Section>
          )}
        </div>

        {/* Низ панели: кнопки экспорта */}
        <footer className="p-4 border-t border-[var(--color-border)] grid grid-cols-3 gap-2">
          <ExportButton
            label="PDF"
            onClick={handleExportPdf}
            disabled={exportingFmt != null}
            busy={exportingFmt === 'pdf'}
          />
          <ExportButton
            label="Excel"
            onClick={handleExportExcel}
            disabled={exportingFmt != null}
            busy={exportingFmt === 'excel'}
          />
          <ExportButton
            label="Word"
            onClick={handleExportWord}
            disabled={exportingFmt != null}
            busy={exportingFmt === 'word'}
          />
        </footer>
      </aside>

      {/* Основная область: лист + навигация */}
      <main className="flex-1 flex flex-col bg-[var(--color-surface)]/40 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
          <div className="text-sm">
            <span className="text-[var(--color-text-secondary)]">Документ: </span>
            <span className="font-medium">{model.fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSheetIdx(i => Math.max(0, i - 1))}
              disabled={sheetIdx === 0}
              className="p-1 rounded hover:bg-[var(--color-surface)] disabled:opacity-30"
              aria-label="Предыдущий лист"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-mono">
              {currentSheet.index + 1} / {sheets.length}
            </span>
            <button
              onClick={() => setSheetIdx(i => Math.min(sheets.length - 1, i + 1))}
              disabled={sheetIdx >= sheets.length - 1}
              className="p-1 rounded hover:bg-[var(--color-surface)] disabled:opacity-30"
              aria-label="Следующий лист"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
          <SheetCanvas model={effectiveModel} sheet={currentSheet} cssWidthPx={900} />
        </div>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1.5">{title}</div>
      {children}
    </div>
  )
}

function ExportButton({
  label,
  onClick,
  disabled,
  busy
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded bg-[var(--color-accent,#3b82f6)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  )
}

interface StampFormProps {
  readonly stamp: Stamp
  readonly onCommonChange: <K extends keyof Stamp>(key: K, value: Stamp[K]) => void
  readonly onPerDocChange: (key: 'drawingTitle' | 'drawingMark', value: string) => void
  readonly onResetPerDoc: () => void
  readonly onApplyAll: () => void
  readonly onLogoChange: (dataUrl: string | undefined) => void
}

const LOGO_MAX_BYTES = 200 * 1024

function StampForm({ stamp, onCommonChange, onPerDocChange, onResetPerDoc, onApplyAll, onLogoChange }: StampFormProps) {
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(`Лого слишком большое (${(file.size / 1024).toFixed(0)} KB). Лимит — 200 KB.`)
      e.target.value = ''
      return
    }
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast.error('Поддерживаются только PNG/JPEG.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') onLogoChange(result)
    }
    reader.onerror = () => toast.error('Не удалось прочитать файл лого.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <Field label="Наименование чертежа" hint="на этом документе">
        <input
          type="text"
          value={stamp.drawingTitle}
          onChange={e => onPerDocChange('drawingTitle', e.target.value)}
          className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
        />
      </Field>
      <Field label="Марка чертежа" hint="на этом документе">
        <input
          type="text"
          value={stamp.drawingMark}
          onChange={e => onPerDocChange('drawingMark', e.target.value)}
          className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]"
        />
      </Field>
      <button onClick={onResetPerDoc} className="text-xs text-[var(--color-text-secondary)] underline">сбросить наименование/марку этого документа</button>

      <hr className="my-2 border-[var(--color-border)]" />

      <Field label="Объект">
        <input value={stamp.objectName} onChange={e => onCommonChange('objectName', e.target.value)}
          placeholder="Жилой дом по адресу..."
          className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Шифр объекта">
          <input value={stamp.objectCode} onChange={e => onCommonChange('objectCode', e.target.value)}
            placeholder="70-2025"
            className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </Field>
        <Field label="Подраздел">
          <input value={stamp.subsectionCode} onChange={e => onCommonChange('subsectionCode', e.target.value)}
            placeholder="ИЛО"
            className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </Field>
        <Field label="Марка">
          <input value={stamp.markCode} onChange={e => onCommonChange('markCode', e.target.value)}
            placeholder="ОВ"
            className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Стадия">
          <select value={stamp.stageCode} onChange={e => onCommonChange('stageCode', e.target.value)}
            className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
            <option value="П">П</option>
            <option value="Р">Р</option>
            <option value="РД">РД</option>
            <option value="Э">Э</option>
          </select>
        </Field>
        <Field label="Дата">
          <input type="date" value={stamp.date} onChange={e => onCommonChange('date', e.target.value)}
            className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </Field>
      </div>

      <Field label="Разработал"><input value={stamp.authorName} onChange={e => onCommonChange('authorName', e.target.value)} className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" /></Field>
      <Field label="Проверил"><input value={stamp.checkerName} onChange={e => onCommonChange('checkerName', e.target.value)} className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" /></Field>
      <Field label="ГИП"><input value={stamp.gipName} onChange={e => onCommonChange('gipName', e.target.value)} className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" /></Field>
      <Field label="Н. контроль"><input value={stamp.normControlName} onChange={e => onCommonChange('normControlName', e.target.value)} className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" /></Field>
      <Field label="Утвердил" hint="опц.">
        <input value={stamp.approverName} onChange={e => onCommonChange('approverName', e.target.value)} className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </Field>

      <Field label="Организация"><input value={stamp.companyName} onChange={e => onCommonChange('companyName', e.target.value)} className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" /></Field>
      <Field label="Подразделение"><input value={stamp.companyDept} onChange={e => onCommonChange('companyDept', e.target.value)} className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" /></Field>

      <hr className="my-2 border-[var(--color-border)]" />
      <div className="text-[11px] text-[var(--color-text-secondary)]">Боковая полоса (ГОСТ Р 21.101)</div>

      <Field label="Согласовано" hint="имя/должность">
        <input value={stamp.agreedBy ?? ''} onChange={e => onCommonChange('agreedBy', e.target.value)}
          className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Инв. № подп.">
          <input value={stamp.inventoryNumber ?? ''} onChange={e => onCommonChange('inventoryNumber', e.target.value)}
            className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </Field>
        <Field label="Взам. инв. №">
          <input value={stamp.replacedInventoryNumber ?? ''} onChange={e => onCommonChange('replacedInventoryNumber', e.target.value)}
            className="w-full px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </Field>
      </div>

      <Field label="Лого" hint="PNG/JPEG, до 200 KB">
        <div className="space-y-1.5">
          {stamp.logoDataUrl && (
            <div className="flex items-center gap-2">
              <img
                src={stamp.logoDataUrl}
                alt="Лого"
                className="h-12 w-12 object-contain border border-[var(--color-border)] rounded bg-white"
              />
              <button
                onClick={() => onLogoChange(undefined)}
                className="text-xs text-red-600 underline"
              >
                удалить
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleLogoFile}
            className="w-full text-xs file:mr-2 file:px-2 file:py-1 file:rounded file:border file:border-[var(--color-border)] file:bg-[var(--color-surface)] file:text-xs"
          />
        </div>
      </Field>

      <button onClick={onApplyAll} className="text-xs text-[var(--color-text-secondary)] underline mt-1">сохранить все поля как параметры по умолчанию</button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] text-[var(--color-text-secondary)] mb-0.5">
        {label}{hint ? <span className="opacity-70"> ({hint})</span> : null}
      </div>
      {children}
    </label>
  )
}
