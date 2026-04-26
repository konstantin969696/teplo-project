/**
 * Phase 06 + 07.1 — single-sheet preview rendered as SVG.
 * 1mm = 1 SVG unit (viewBox in mm). CSS scales to pixel size.
 *
 * Geometry must match what fold-out adapters (PDF/Excel/Word) will draw —
 * see backends/pdf.ts for the source of truth.
 */

import type { Sheet, DocumentModel, Stamp, ContentBlock, TableCell, StampMode } from '../types'
import { dimensions, effectiveOrientation, formatStampMark } from '../sheet/formats'
import { computeFrame, FRAME_LINE_THICK_MM, FRAME_LINE_THIN_MM } from '../sheet/frame'
import {
  computeStampPosition,
  STAMP_GEOMETRY,
  STAMP_HEIGHT_MM,
  buildDesignationCode,
  signerDate
} from '../sheet/stamp'

interface SheetCanvasProps {
  readonly model: DocumentModel
  readonly sheet: Sheet
  readonly cssWidthPx?: number
}

const FONT = 'Arial, "PT Sans Caption", sans-serif'
const SIDEBAR_WIDTH_MM = 7
const FOOTER_MIN_HEIGHT_MM = 8
const FORMAT_MARK_GAP_MM = 1.5

export function SheetCanvas({ model, sheet, cssWidthPx }: SheetCanvasProps) {
  const orient = effectiveOrientation(model.format, model.orientation)
  const dims = dimensions(model.format, orient)
  const frame = computeFrame(dims.widthMm, dims.heightMm)
  const stamp = computeStampPosition(frame)
  const mode: StampMode = model.stampMode ?? 'full'

  const ratio = dims.heightMm / dims.widthMm
  const wPx = cssWidthPx ?? 800
  const hPx = wPx * ratio

  const contentBottom =
    mode === 'full'
      ? frame.yMm + frame.heightMm - STAMP_HEIGHT_MM - 2
      : mode === 'minimal-footer'
        ? frame.yMm + frame.heightMm - FOOTER_MIN_HEIGHT_MM - 2
        : frame.yMm + frame.heightMm - 4

  return (
    <svg
      viewBox={`0 0 ${dims.widthMm} ${dims.heightMm}`}
      width={wPx}
      height={hPx}
      style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={dims.widthMm} height={dims.heightMm} fill="white" stroke="#ddd" strokeWidth={FRAME_LINE_THIN_MM} />

      {/* Рамка ГОСТ */}
      <rect
        x={frame.xMm} y={frame.yMm}
        width={frame.widthMm} height={frame.heightMm}
        fill="none" stroke="black" strokeWidth={FRAME_LINE_THICK_MM}
      />

      {/* Контент */}
      <foreignObject
        x={frame.xMm + 4}
        y={frame.yMm + 4}
        width={frame.widthMm - 8}
        height={contentBottom - frame.yMm - 4}
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

      {/* Маркировка формата (под рамкой справа внизу), для full/minimal */}
      {mode !== 'none' && (
        <FormatMark
          mark={formatStampMark(model.format, model.orientation)}
          frame={frame}
          sheetHeightMm={dims.heightMm}
        />
      )}

      {mode === 'full' && (
        <>
          <SideBar stamp={model.stamp} frame={frame} />
          <StampForm1
            stamp={model.stamp}
            sheetIndex={sheet.index}
            sheetTotal={sheet.total}
            pos={stamp}
          />
        </>
      )}

      {mode === 'minimal-footer' && (
        <FooterLine
          text={model.footerLine ?? ''}
          sheetIndex={sheet.index}
          sheetTotal={sheet.total}
          frame={frame}
        />
      )}
    </svg>
  )
}

// ─── Content blocks ───────────────────────────────────────────────────────

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

// ─── Stamp form 1 ──────────────────────────────────────────────────────────

interface StampForm1Props {
  readonly stamp: Stamp
  readonly sheetIndex: number
  readonly sheetTotal: number
  readonly pos: { xMm: number; yMm: number; widthMm: number; heightMm: number }
}

function StampForm1({ stamp, sheetIndex, sheetTotal, pos }: StampForm1Props) {
  const { xMm: x, yMm: y, widthMm: W, heightMm: H } = pos
  const G = STAMP_GEOMETRY

  // ── Графа изменений (нижний-левый блок 75×25) ──
  const ch = G.changes
  const chX = x + ch.x
  const chY = y + ch.y
  const chCols: { left: number; col: typeof ch.cols[number] }[] = []
  let cxAcc = 0
  for (const col of ch.cols) {
    chCols.push({ left: cxAcc, col })
    cxAcc += col.width
  }

  // ── Графы 10-13 ──
  const sg = G.signers
  const sgX = x + sg.x
  const sgY = y + sg.y
  const sgCols = sg.cols
  const colOffsets = sgCols.reduce<number[]>((acc, c) => {
    const last = acc[acc.length - 1] ?? 0
    acc.push(last + c.width)
    return acc
  }, [0])

  const signerRows: { role: string; name: string; date: string }[] = [
    { role: 'Разраб.', name: stamp.authorName, date: signerDate(stamp, 'author') },
    { role: 'Проверил', name: stamp.checkerName, date: signerDate(stamp, 'checker') },
    { role: 'ГИП', name: stamp.gipName, date: signerDate(stamp, 'gip') },
    { role: 'Н. контр.', name: stamp.normControlName, date: signerDate(stamp, 'normControl') },
    { role: 'Утв.', name: stamp.approverName, date: stamp.approverName ? signerDate(stamp, 'approver') : '' }
  ]

  const ti = G.title
  const tiX = x + ti.x
  const tiY = y + ti.y

  const st = G.stage
  const stX = x + st.x
  const stY = y + st.y
  const stCols = [
    { id: 'stage', label: 'Стадия', value: stamp.stageCode, w: 30 },
    { id: 'sheet', label: 'Лист', value: String(sheetIndex + 1), w: 20 },
    { id: 'sheets', label: 'Листов', value: String(sheetTotal), w: 20 }
  ]

  const co = G.company
  const coX = x + co.x
  const coY = y + co.y
  const logoH = co.height * 0.55
  const textY = coY + logoH

  const designation = buildDesignationCode(stamp)

  return (
    <g>
      {/* Внешняя рамка штампа */}
      <rect x={x} y={y} width={W} height={H} fill="white" stroke="black" strokeWidth={FRAME_LINE_THICK_MM} />

      {/* === Графа изменений === */}
      {/* Вертикальные разделители */}
      {chCols.slice(1).map((c, i) => (
        <line key={`chv-${i}`} x1={chX + c.left} y1={chY} x2={chX + c.left} y2={chY + ch.height}
          stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      ))}
      {/* Горизонтальные разделители */}
      {[1, 2, 3, 4, 5].map(r => (
        <line key={`chh-${r}`} x1={chX} y1={chY + r * 5} x2={chX + ch.width} y2={chY + r * 5}
          stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      ))}
      {/* Заголовки */}
      {chCols.map(({ left, col }) => (
        <text
          key={`chl-${col.id}`}
          x={chX + left + col.width / 2}
          y={chY + 3.5}
          fontSize={2.5}
          fontFamily={FONT}
          textAnchor="middle"
        >{col.label}</text>
      ))}

      {/* === Графы 10-13 (подписанты) === */}
      {/* Вертикальные разделители */}
      {colOffsets.slice(1, -1).map((off, i) => (
        <line key={`sgv-${i}`} x1={sgX + off} y1={sgY} x2={sgX + off} y2={sgY + sg.height}
          stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      ))}
      {/* Горизонтальные разделители */}
      {[1, 2, 3, 4, 5].map(r => (
        <line key={`sgh-${r}`} x1={sgX} y1={sgY + r * sg.rowHeight} x2={sgX + sg.width} y2={sgY + r * sg.rowHeight}
          stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      ))}
      {/* Содержимое */}
      {signerRows.map((row, ri) => {
        const ry = sgY + ri * sg.rowHeight
        return (
          <g key={`sgrow-${ri}`}>
            <text x={sgX + 0.6} y={ry + sg.rowHeight * 0.65} fontSize={3} fontFamily={FONT}>{row.role}</text>
            <text x={sgX + colOffsets[1]! + 0.6} y={ry + sg.rowHeight * 0.65} fontSize={3} fontFamily={FONT}>{truncate(row.name, sg.cols[1]!.width * 1.5)}</text>
            <text x={sgX + colOffsets[3]! + 0.6} y={ry + sg.rowHeight * 0.65} fontSize={3} fontFamily={FONT}>{row.date}</text>
          </g>
        )
      })}

      {/* === Графы 1-2 (Обозначение / Название) === */}
      {/* Линия между обозначением и названием */}
      <line x1={tiX} y1={tiY + ti.designationHeight} x2={tiX + ti.width} y2={tiY + ti.designationHeight}
        stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      {/* Шифр (графа 2) */}
      <text x={tiX + ti.width / 2} y={tiY + ti.designationHeight * 0.65}
        fontSize={5.5} fontFamily={FONT} fontWeight={700} textAnchor="middle">{designation}</text>
      {/* Название (графа 1) */}
      <foreignObject x={tiX + 1} y={tiY + ti.designationHeight + 1}
        width={ti.width - 2} height={ti.height - ti.designationHeight - 6}>
        <div style={{
          font: `bold 4.5px ${FONT}`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          {stamp.drawingTitle || ''}
        </div>
      </foreignObject>

      {/* === Графы 4/7/8 (Стадия / Лист / Листов) — 70×10, 2 строки === */}
      {/* Верхняя горизонтальная линия (между title и stage) */}
      <line x1={stX} y1={stY} x2={stX + st.width} y2={stY}
        stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      {/* Средняя горизонтальная линия (между заголовками и значениями) */}
      <line x1={stX} y1={stY + st.height / 2} x2={stX + st.width} y2={stY + st.height / 2}
        stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      {/* Вертикальные разделители колонок */}
      {(() => {
        let off = 0
        return stCols.slice(0, -1).map((c, i) => {
          off += c.w
          return (
            <line key={`stv-${i}`} x1={stX + off} y1={stY} x2={stX + off} y2={stY + st.height}
              stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
          )
        })
      })()}
      {/* Текст в ячейках */}
      {(() => {
        let off = 0
        return stCols.map((c, i) => {
          const cellX = stX + off
          off += c.w
          const halfH = st.height / 2
          return (
            <g key={`stc-${i}`}>
              <text x={cellX + c.w / 2} y={stY + halfH * 0.7}
                fontSize={2.8} fontFamily={FONT} fill="#555" textAnchor="middle">{c.label}</text>
              <text x={cellX + c.w / 2} y={stY + halfH + halfH * 0.75}
                fontSize={4} fontFamily={FONT} fontWeight={700} textAnchor="middle">{c.value}</text>
            </g>
          )
        })
      })()}

      {/* === Графа 9 (организация + лого) === */}
      <line x1={coX} y1={textY} x2={coX + co.width} y2={textY}
        stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      {stamp.logoDataUrl && (
        <image
          href={stamp.logoDataUrl}
          x={coX + 1}
          y={coY + 1}
          width={co.width - 2}
          height={logoH - 2}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <foreignObject x={coX} y={textY} width={co.width} height={co.height - logoH - (stamp.companyDept ? 3 : 0)}>
        <div style={{
          font: `bold 3px ${FONT}`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 0.5mm'
        }}>
          {stamp.companyName || ''}
        </div>
      </foreignObject>
      {stamp.companyDept && (
        <text x={coX + co.width / 2} y={coY + co.height - 0.8}
          fontSize={2.2} fontFamily={FONT} fill="#666" textAnchor="middle">{stamp.companyDept}</text>
      )}
    </g>
  )
}

// ─── Side bar ──────────────────────────────────────────────────────────────

interface SideBarProps {
  readonly stamp: Stamp
  readonly frame: { xMm: number; yMm: number; widthMm: number; heightMm: number }
}

function SideBar({ stamp, frame }: SideBarProps) {
  const x = frame.xMm - SIDEBAR_WIDTH_MM
  const y = frame.yMm
  const w = SIDEBAR_WIDTH_MM
  const h = frame.heightMm

  const sections = [
    { label: 'Согласовано', value: stamp.agreedBy ?? '', heightFrac: 0.30 },
    { label: 'Инв. № подл.', value: stamp.inventoryNumber ?? '', heightFrac: 0.22 },
    { label: 'Подп. и дата', value: '', heightFrac: 0.26 },
    { label: 'Взам. инв. №', value: stamp.replacedInventoryNumber ?? '', heightFrac: 0.22 }
  ]

  let cy = y
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      {sections.map((sec, i) => {
        const sh = h * sec.heightFrac
        const top = cy
        cy += sh
        return (
          <g key={i}>
            {i > 0 && (
              <line x1={x} y1={top} x2={x + w} y2={top} stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
            )}
            {/* Текст вертикально, повёрнут на 90° против ч.с. (rotate -90) */}
            <text
              transform={`rotate(-90, ${x + w / 2}, ${top + sh / 2})`}
              x={x + w / 2}
              y={top + sh / 2 + 1}
              fontSize={2.4}
              fontFamily={FONT}
              textAnchor="middle"
            >
              {sec.label}{sec.value ? ` — ${sec.value}` : ''}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── Format mark ───────────────────────────────────────────────────────────

interface FormatMarkProps {
  readonly mark: string
  readonly frame: { xMm: number; yMm: number; widthMm: number; heightMm: number }
  readonly sheetHeightMm: number
}

function FormatMark({ mark, frame, sheetHeightMm }: FormatMarkProps) {
  const markY = Math.min(sheetHeightMm - 0.5, frame.yMm + frame.heightMm + FORMAT_MARK_GAP_MM + 2)
  return (
    <text
      x={frame.xMm + frame.widthMm}
      y={markY}
      fontSize={2.3}
      fontFamily={FONT}
      fill="#666"
      textAnchor="end"
    >{mark}</text>
  )
}

// ─── Footer line ───────────────────────────────────────────────────────────

interface FooterLineProps {
  readonly text: string
  readonly sheetIndex: number
  readonly sheetTotal: number
  readonly frame: { xMm: number; yMm: number; widthMm: number; heightMm: number }
}

function FooterLine({ text, sheetIndex, sheetTotal, frame }: FooterLineProps) {
  const lineY = frame.yMm + frame.heightMm - FOOTER_MIN_HEIGHT_MM
  return (
    <g>
      <line x1={frame.xMm} y1={lineY} x2={frame.xMm + frame.widthMm} y2={lineY}
        stroke="black" strokeWidth={FRAME_LINE_THIN_MM} />
      {text && (
        <text x={frame.xMm + 2} y={lineY + 5} fontSize={3.5} fontFamily={FONT}>{text}</text>
      )}
      {sheetTotal > 1 && (
        <text x={frame.xMm + frame.widthMm - 2} y={lineY + 5} fontSize={3.5} fontFamily={FONT} textAnchor="end">
          Лист {sheetIndex + 1} из {sheetTotal}
        </text>
      )}
    </g>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function truncate(text: string, maxChars: number): string {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, Math.max(0, maxChars - 1)) + '…'
}
