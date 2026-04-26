/**
 * Phase 06 — DocumentModel builders, one per tab.
 * Pure read of stores → format-agnostic ContentBlock list.
 *
 * Each builder owns its `drawingTitle` and a sensible default `markCode`.
 */

import { useProjectStore } from '../../store/projectStore'
import { useSystemStore } from '../../store/systemStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'
import { useExportStore } from '../store/exportStore'
import { findFormat } from '../sheet/formats'
import { calculateRoomTotals } from '../../engine/heatLoss'
import type { DocumentModel, ContentBlock, Stamp } from '../types'
import type { Room } from '../../types/project'

const SCHEMA_LABEL: Record<string, string> = {
  'two-pipe-dead-end': 'Двухтруб. тупиковая',
  'two-pipe-flow-through': 'Двухтруб. попутная',
  'one-pipe-vertical': 'Однотруб. вертикальная',
  'one-pipe-horizontal': 'Однотруб. горизонтальная',
  'collector': 'Лучевая (коллекторная)'
}

interface BuilderContext {
  readonly stamp: Stamp
  readonly formatId: string
  readonly orientation: 'portrait' | 'landscape'
}

function readBuilderContext(overrideTitle: string, overrideMark: string): BuilderContext {
  const exp = useExportStore.getState()
  return {
    stamp: { ...exp.stamp, drawingTitle: overrideTitle, drawingMark: overrideMark },
    formatId: exp.defaultFormatId,
    orientation: exp.defaultOrientation
  }
}

function makeModel(
  id: string,
  fileName: string,
  ctx: BuilderContext,
  content: readonly ContentBlock[]
): DocumentModel {
  const fmt = findFormat(ctx.formatId) ?? findFormat('A4')!
  return {
    id,
    fileName,
    format: fmt,
    orientation: ctx.orientation,
    stamp: ctx.stamp,
    content
  }
}

function projectHeader(): ContentBlock {
  const p = useProjectStore.getState()
  return {
    kind: 'kv-grid',
    columns: 4,
    items: [
      { label: 'Город', value: p.city?.name ?? '—' },
      { label: 't наружная', value: p.city != null ? `${p.city.tOutside} °C` : '—' },
      { label: 't внутри', value: `${p.tInside} °C` },
      { label: 'ΔT', value: p.city != null ? `${p.tInside - p.city.tOutside} K` : '—' },
      { label: 'ГСОП', value: p.city?.gsop != null ? `${p.city.gsop}` : '—' },
      { label: 'Зона влажности', value: p.city?.humidityZone ?? '—' }
    ]
  }
}

// ─── 1. Теплопотери ───
export function buildHeatLossDocument(): DocumentModel {
  const ctx = readBuilderContext('Теплопотери', 'ОВ.001')
  const p = useProjectStore.getState()
  const enc = useEnclosureStore.getState()
  const tOutside = p.city?.tOutside ?? null

  const rows: (string | number)[][] = []
  let totalQ = 0

  if (tOutside != null) {
    for (const rid of p.roomOrder) {
      const room = p.rooms[rid]
      if (!room) continue
      const dt = room.tInside - tOutside
      const roomEncs = enc.enclosureOrder
        .filter(eid => enc.enclosures[eid]?.roomId === rid)
        .map(eid => enc.enclosures[eid])
        .filter((e): e is NonNullable<typeof e> => e != null)
      const r = calculateRoomTotals(roomEncs, room as Room, dt)
      totalQ += r.qTotal
      rows.push([
        room.name || `№${room.number}`,
        room.floor,
        room.area,
        Math.round(r.qBasic),
        Math.round(r.qInfiltration),
        Math.round(r.qVentilation),
        Math.round(r.qTotal)
      ])
    }
  }

  const content: ContentBlock[] = [
    { kind: 'heading', level: 1, text: 'Расчёт теплопотерь' },
    projectHeader(),
    {
      kind: 'table',
      columns: [
        { id: 'name', title: 'Помещение', align: 'left' },
        { id: 'floor', title: 'Эт.', align: 'center' },
        { id: 'area', title: 'Пл. м²', align: 'right' },
        { id: 'qBasic', title: 'Q_осн, Вт', align: 'right' },
        { id: 'qInf', title: 'Q_инф, Вт', align: 'right' },
        { id: 'qVent', title: 'Q_вент, Вт', align: 'right' },
        { id: 'qTotal', title: 'Q_итого, Вт', align: 'right' }
      ],
      rows,
      footer: ['Итого', '', '', '', '', '', { text: `${Math.round(totalQ)}`, bold: true }]
    },
    { kind: 'paragraph', text: 'Расчёт по СП 50.13330.2012, СП 131.13330.2020.' }
  ]
  return makeModel('heat-loss', 'Теплопотери', ctx, content)
}

// ─── 2. Приборы отопления ───
export function buildEquipmentDocument(): DocumentModel {
  const ctx = readBuilderContext('Спецификация приборов отопления', 'ОВ.002')
  const p = useProjectStore.getState()
  const eq = useEquipmentStore.getState()

  const rows: (string | number)[][] = eq.equipmentOrder
    .map(id => eq.equipment[id])
    .filter((e): e is NonNullable<typeof e> => e != null)
    .map(e => [
      p.rooms[e.roomId]?.name ?? '—',
      e.kind,
      e.connection,
      e.installation,
      e.catalogModelId ?? 'ручной ввод'
    ])

  const content: ContentBlock[] = [
    { kind: 'heading', level: 1, text: 'Спецификация приборов отопления' },
    projectHeader(),
    {
      kind: 'table',
      columns: [
        { id: 'room', title: 'Помещение', align: 'left' },
        { id: 'kind', title: 'Тип', align: 'left' },
        { id: 'conn', title: 'Подключение', align: 'left' },
        { id: 'inst', title: 'Установка', align: 'left' },
        { id: 'model', title: 'Модель', align: 'left' }
      ],
      rows
    }
  ]
  return makeModel('equipment', 'Приборы_отопления', ctx, content)
}

// ─── 3. Гидравлика ───
export function buildHydraulicsDocument(): DocumentModel {
  const ctx = readBuilderContext('Гидравлический расчёт', 'ОВ.003')
  const sys = useSystemStore.getState()
  const systems = sys.systemOrder.map(id => sys.systems[id]).filter((s): s is NonNullable<typeof s> => s != null)

  const content: ContentBlock[] = [
    { kind: 'heading', level: 1, text: 'Гидравлический расчёт' },
    projectHeader(),
    ...systems.map((s): ContentBlock => ({
      kind: 'kv-grid',
      columns: 3,
      items: [
        { label: 'Система', value: s.name },
        { label: 'Схема', value: SCHEMA_LABEL[s.schemaType] ?? s.schemaType },
        { label: 't подачи / обратки', value: `${s.tSupply} / ${s.tReturn} °C` },
        { label: 'Теплоноситель', value: s.coolantId },
        { label: 'Материал труб', value: s.pipeMaterialId }
      ]
    })),
    { kind: 'paragraph', text: 'Полный расчёт по участкам — см. вкладку «Гидравлика» в приложении (будет добавлен в фазе 07).' }
  ]
  return makeModel('hydraulics', 'Гидравлика', ctx, content)
}

// ─── 4. Тёплый пол ───
export function buildUfhDocument(): DocumentModel {
  const ctx = readBuilderContext('Тёплый пол — спецификация', 'ОВ.004')
  const p = useProjectStore.getState()
  const u = useUfhLoopStore.getState()

  const rows = Object.values(u.loops)
    .filter(l => l.enabled)
    .map(l => [
      p.rooms[l.roomId]?.name ?? '—',
      l.activeAreaM2,
      l.stepCm,
      l.covering,
      l.pipeId
    ])

  const content: ContentBlock[] = [
    { kind: 'heading', level: 1, text: 'Тёплый пол — спецификация' },
    projectHeader(),
    {
      kind: 'table',
      columns: [
        { id: 'room', title: 'Помещение', align: 'left' },
        { id: 'area', title: 'F_тп, м²', align: 'right' },
        { id: 'step', title: 'Шаг, см', align: 'right' },
        { id: 'cov', title: 'Покрытие', align: 'left' },
        { id: 'pipe', title: 'Труба', align: 'left' }
      ],
      rows
    }
  ]
  return makeModel('ufh', 'Тёплый_пол', ctx, content)
}

// ─── 5. Сводка ───
export function buildSummaryDocument(): DocumentModel {
  const ctx = readBuilderContext('Сводка по объекту', 'ОВ.000')
  const heatLoss = buildHeatLossDocument()
  const equipment = buildEquipmentDocument()
  const hydraulics = buildHydraulicsDocument()
  const ufh = buildUfhDocument()
  return {
    id: 'summary',
    fileName: 'Сводка',
    format: heatLoss.format,
    orientation: heatLoss.orientation,
    stamp: ctx.stamp,
    content: [
      { kind: 'heading', level: 1, text: 'Сводка по объекту' },
      projectHeader(),
      ...heatLoss.content.slice(2),
      ...equipment.content.slice(2),
      ...hydraulics.content.slice(2),
      ...ufh.content.slice(2)
    ]
  }
}

export const DOCUMENT_BUILDERS = {
  'heat-loss': buildHeatLossDocument,
  equipment: buildEquipmentDocument,
  hydraulics: buildHydraulicsDocument,
  ufh: buildUfhDocument,
  summary: buildSummaryDocument
} as const

export type DocumentBuilderId = keyof typeof DOCUMENT_BUILDERS
