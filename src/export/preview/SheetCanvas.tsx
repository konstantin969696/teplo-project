/**
 * Phase 06 — single-sheet preview rendered as SVG.
 * 1mm = 1 SVG unit (viewBox in mm). CSS scales to pixel size.
 *
 * Geometry must match what fold-out adapters (PDF/Excel/Word) will draw.
 */

import type { Sheet, DocumentModel, Stamp, ContentBlock, TableCell } from '../types'
import { dimensions, effectiveOrientation } from '../sheet/formats'
import { computeFrame, FRAME_LINE_THICK_MM, FRAME_LINE_THIN_MM } from '../sheet/frame'
import { computeStampPosition, formatStampDate, formatSheetCounter } from '../sheet/stamp'

interface SheetCanvasProps {
  readonly model: DocumentModel
  readonly sheet: Sheet
  readonly cssWidthPx?: number  // визуальный размер в превью; если не задан — 100% контейнера
}

const FONT = 'Arial, "PT Sans Caption", sans-serif'

export function SheetCanvas({ model, sheet, cssWidthPx }: SheetCanvasProps) {
  const orient = effectiveOrientation(model.format, model.orientation)
  const dims = dimensions(model.format, orient)
  const frame = computeFrame(dims.widthMm, dims.heightMm)
  const stamp = computeStampPosition(frame)

  const ratio = dims.heightMm / dims.widthMm
  const wPx = cssWidthPx ?? 800
  const hPx = wPx * ratio

  return (
    <svg
      viewBox={`0 0 ${dims.widthMm} ${dims.heightMm}`}
      width={wPx}
      height={hPx}
      style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Лист (фон, белый) */}
      <rect x={0} y={0} width={dims.widthMm} height={dims.heightMm} fill="white" stroke="#ddd" strokeWidth={FRAME_LINE_THIN_MM} />
      {/* Рамка ГОСТ */}
      <rect
        x={frame.xMm} y={frame.yMm}
        width={frame.widthMm} height={frame.heightMm}
        fill="none" stroke="black" strokeWidth={FRAME_LINE_THICK_MM}
      />

      {/* Содержимое (HTML через foreignObject — для текста/таблиц) */}
      <foreignObject
        x={frame.xMm + 4}
        y={frame.yMm + 4}
        width={frame.widthMm - 8}
        height={frame.heightMm - stamp.heightMm - 8}
      >
        <div
          style={{
            font: `3.5px ${FONT}`,
            color: 'black',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {sheet.blocks.map((b, i) => <BlockView key={i} block={b} />)}
        </div>
      </foreignObject>

      {/* Штамп ГОСТ 2.104 — упрощённый */}
      <StampBlock stamp={model.stamp} sheetIndex={sheet.index} sheetTotal={sheet.total} pos={stamp} />
    </svg>
  )
}

function BlockView({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case 'heading': {
      const sizes = { 1: 6, 2: 5, 3: 4 }
      return (
        <div style={{ fontSize: `${sizes[block.level]}px`, fontWeight: 700, margin: '2px 0 1px 0' }}>
          {block.text}
        </div>
      )
    }
    case 'paragraph':
      return <div style={{ margin: '1px 0', fontSize: '3px' }}>{block.text}</div>
    case 'kv-grid':
      return (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
          gap: '0.5mm',
          margin: '1mm 0',
          fontSize: '2.8px'
        }}>
          {block.items.map((it, i) => (
            <div key={i}>
              <div style={{ fontSize: '2.4px', color: '#555', textTransform: 'uppercase' }}>{it.label}</div>
              <div style={{ fontWeight: 500 }}>{it.value}</div>
            </div>
          ))}
        </div>
      )
    case 'table':
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '2.6px', margin: '1mm 0' }}>
          <thead>
            <tr style={{ borderBottom: '0.2mm solid black' }}>
              {block.columns.map(col => (
                <th key={col.id} style={{ padding: '0.3mm 0.5mm', textAlign: col.align, fontWeight: 700 }}>{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '0.05mm solid #ccc' }}>
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: '0.2mm 0.5mm', textAlign: block.columns[j]?.align ?? 'left' }}>
                    {renderCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {block.footer && (
              <tr style={{ borderTop: '0.2mm solid black' }}>
                {block.footer.map((cell, j) => (
                  <td key={j} style={{ padding: '0.3mm 0.5mm', textAlign: block.columns[j]?.align ?? 'left', fontWeight: 700 }}>
                    {renderCell(cell)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      )
  }
}

function renderCell(c: TableCell): React.ReactNode {
  if (typeof c === 'string' || typeof c === 'number') return c
  return <span style={{ fontWeight: c.bold ? 700 : 400 }}>{c.text}</span>
}

interface StampBlockProps {
  readonly stamp: Stamp
  readonly sheetIndex: number
  readonly sheetTotal: number
  readonly pos: { xMm: number; yMm: number; widthMm: number; heightMm: number }
}

function StampBlock({ stamp, sheetIndex, sheetTotal, pos }: StampBlockProps) {
  const { xMm: x, yMm: y, widthMm: W, heightMm: H } = pos
  // Упрощённая разбивка: левый блок (подписи) 70мм, средний (наименование) 50мм, правый 65мм
  const colA = 70, colB = 50
  const lineH = H / 8

  const lines = [
    { label: 'Разработал', name: stamp.authorName },
    { label: 'Проверил', name: stamp.checkerName },
    { label: 'Н. контроль', name: stamp.normControlName },
    { label: 'Утвердил', name: stamp.approverName }
  ]

  return (
    <g>
      {/* Внешняя рамка штампа */}
      <rect x={x} y={y} width={W} height={H} fill="white" stroke="black" strokeWidth={FRAME_LINE_THICK_MM} />
      {/* Вертикальные разделители */}
      <line x1={x + colA} y1={y} x2={x + colA} y2={y + H} stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      <line x1={x + colA + colB} y1={y} x2={x + colA + colB} y2={y + H} stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      {/* Горизонтальные разделители в левом блоке (4 строки подписей) */}
      {lines.map((_, i) => (
        <line key={i} x1={x} y1={y + lineH * (i + 1)} x2={x + colA} y2={y + lineH * (i + 1)} stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      ))}
      {/* Подписи */}
      {lines.map((l, i) => (
        <g key={i}>
          <text x={x + 1} y={y + lineH * i + 2.5} fontSize={2.5} fontFamily={FONT}>{l.label}</text>
          <text x={x + 22} y={y + lineH * i + 2.5} fontSize={2.5} fontFamily={FONT}>{l.name}</text>
          <text x={x + colA - 18} y={y + lineH * i + 2.5} fontSize={2.5} fontFamily={FONT} fill="#555">подп.</text>
          <text x={x + colA - 8} y={y + lineH * i + 2.5} fontSize={2.5} fontFamily={FONT} fill="#555">{i === 0 ? formatStampDate(stamp.date) : ''}</text>
        </g>
      ))}
      {/* Средний блок: drawing title */}
      <foreignObject x={x + colA + 1} y={y + 1} width={colB - 2} height={H - 2}>
        <div style={{
          font: `bold 4px ${FONT}`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          {stamp.drawingTitle || '—'}
        </div>
      </foreignObject>
      {/* Правый блок: марка, стадия, лист */}
      <text x={x + colA + colB + 1} y={y + 4} fontSize={3} fontFamily={FONT} fontWeight={700}>{stamp.drawingMark}</text>
      <line x1={x + colA + colB} y1={y + 6} x2={x + W} y2={y + 6} stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      <text x={x + colA + colB + 1} y={y + 10} fontSize={2.5} fontFamily={FONT}>Стадия: {stamp.stageCode}</text>
      <line x1={x + colA + colB} y1={y + 13} x2={x + W} y2={y + 13} stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      <text x={x + colA + colB + 1} y={y + 17} fontSize={2.5} fontFamily={FONT}>{formatSheetCounter(sheetIndex, sheetTotal)}</text>
      <line x1={x + colA + colB} y1={y + 20} x2={x + W} y2={y + 20} stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      <foreignObject x={x + colA + colB + 1} y={y + 22} width={W - colA - colB - 2} height={20}>
        <div style={{ font: `2.6px ${FONT}` }}>
          <div><b>{stamp.companyName}</b></div>
          <div style={{ color: '#555' }}>{stamp.companyDept}</div>
          <div style={{ marginTop: '1mm', color: '#555' }}>{stamp.objectName}</div>
        </div>
      </foreignObject>
      {stamp.logoDataUrl && (
        <image
          href={stamp.logoDataUrl}
          x={x + colA + colB + 1}
          y={y + 43}
          width={W - colA - colB - 2}
          height={11}
          preserveAspectRatio="xMinYMid meet"
        />
      )}
    </g>
  )
}
