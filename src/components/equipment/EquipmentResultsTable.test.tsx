/**
 * Integration tests for EquipmentResultsTable.
 * Verify: empty state, per-room rendering, typeSize text for sectional/panel,
 *         Σ aggregation, insufficient row styling.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { calculateRoomTotals } from '../../engine/heatLoss'

vi.mock('../../workers/useEngineWorker', () => ({
  getEngineWorker: () => ({
    heatLossForRooms: async (
      enclosures: Record<string, never>,
      enclosureOrder: string[],
      rooms: Record<string, never>,
      roomOrder: string[],
      tOutside: number
    ) => {
      const enclList = enclosureOrder.map(id => enclosures[id]).filter(Boolean)
      return roomOrder
        .map(id => rooms[id])
        .filter(Boolean)
        .map(room => {
          const re = enclList.filter(e => (e as { roomId: string }).roomId === (room as { id: string }).id)
          const dt = (room as { tInside: number }).tInside - tOutside
          return calculateRoomTotals(re as never, room as never, dt)
        })
    },
  }),
}))

import { EquipmentResultsTable } from './EquipmentResultsTable'
import { useProjectStore } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useCatalogStore } from '../../store/catalogStore'
import { useSystemStore } from '../../store/systemStore'
import type { Room } from '../../types/project'

let roomNumberCounter = 100
function baseRoom(id: string, name: string, area = 20): Room {
  roomNumberCounter += 1
  return {
    id,
    number: roomNumberCounter,
    name,
    floor: 1,
    area,
    height: 2.7,
    isCorner: false,
    infiltrationMethod: 'rate',
    nInfiltration: 0.5,
    gapArea: null,
    windSpeed: null,
    lVentilation: 0,
    tInside: 20,
  }
}

beforeEach(() => {
  useProjectStore.setState({
    city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
    tInside: 20,
    rooms: {},
    roomOrder: [],
    customCities: [],
  })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  useCatalogStore.getState().resetToSeed()
})

describe('EquipmentResultsTable', () => {
  it('renders nothing when there are no rooms', () => {
    const { container } = render(<EquipmentResultsTable />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a row with "—" typeSize when room has no equipment', () => {
    const room = baseRoom('r1', 'Спальня')
    useProjectStore.setState({ rooms: { r1: room }, roomOrder: ['r1'] })

    render(<EquipmentResultsTable />)
    expect(screen.getByText('Спальня')).toBeInTheDocument()
    const row = screen.getByTestId('results-row-r1')
    // Type size cell is the fourth cell (index 3) — no equipment → "—"
    const cells = within(row).getAllByRole('cell')
    expect(cells[3].textContent).toBe('—')
    expect(cells[4].textContent).toBe('—') // Q_факт
    expect(cells[5].textContent).toBe('—') // Запас
  })

  it('renders sectional typeSize "× N секц." and computes qActual for bimetal equipment', async () => {
    const room = baseRoom('r1', 'Гостиная')
    useProjectStore.setState({ rooms: { r1: room }, roomOrder: ['r1'] })
    useEnclosureStore.getState().addEnclosure({
      roomId: 'r1',
      type: 'wall-ext',
      orientation: 'С',
      area: 12,
      kValue: 0.35,
      nCoeff: 1.0,
      nOverridden: false,
      adjacentRoomName: null,
      tAdjacent: null,
      perimeterOverride: null,
      zoneR: [2.1, 4.3, 8.6, 14.2],
      parentEnclosureId: null,
      constructionId: null,
    })
    useEquipmentStore.getState().addEquipment({
      roomId: 'r1',
      kind: 'bimetal',
      catalogModelId: 'rifar-base-500',
      connection: 'side',
      installation: 'open',
      panelType: null,
      panelHeightMm: null,
      panelLengthMm: null,
      sectionsOverride: null,
      convectorLengthMm: null,
      manualQNominal: null,
      manualNExponent: null,
    })

    render(<EquipmentResultsTable />)
    // Q_факт is computed after worker resolves qRequired
    await waitFor(() => {
      const cells = within(screen.getByTestId('results-row-r1')).getAllByRole('cell')
      expect(cells[4].textContent).not.toBe('—')
    })
    const row = screen.getByTestId('results-row-r1')
    const cells = within(row).getAllByRole('cell')

    expect(cells[3].textContent).toMatch(/Rifar Base 500 × \d+ секц\./)
    expect(parseFloat(cells[4].textContent ?? '0')).toBeGreaterThan(0)
    expect(cells[2].textContent).toBe('80-60')
  })

  it('aggregates Σ Q_пом and Σ Q_факт across multiple rooms', async () => {
    const r1 = baseRoom('r1', 'Комната 1', 20)
    const r2 = baseRoom('r2', 'Комната 2', 25)
    useProjectStore.setState({ rooms: { r1, r2 }, roomOrder: ['r1', 'r2'] })

    for (const rid of ['r1', 'r2']) {
      useEnclosureStore.getState().addEnclosure({
        roomId: rid,
        type: 'wall-ext',
        orientation: 'С',
        area: 12,
        kValue: 0.35,
        nCoeff: 1.0,
        nOverridden: false,
        adjacentRoomName: null,
        tAdjacent: null,
        perimeterOverride: null,
        zoneR: [2.1, 4.3, 8.6, 14.2],
        parentEnclosureId: null,
        constructionId: null,
      })
      useEquipmentStore.getState().addEquipment({
        roomId: rid,
        kind: 'bimetal',
        catalogModelId: 'rifar-base-500',
        connection: 'side',
        installation: 'open',
        panelType: null,
        panelHeightMm: null,
        panelLengthMm: null,
        sectionsOverride: null,
        convectorLengthMm: null,
        manualQNominal: null,
        manualNExponent: null,
      })
    }

    render(<EquipmentResultsTable />)

    // Wait for worker to resolve qRequired for both rooms
    await waitFor(() => {
      expect(parseFloat(screen.getByTestId('sum-q-required').textContent ?? '0')).toBeGreaterThan(0)
    })

    const sumQReq = parseFloat(screen.getByTestId('sum-q-required').textContent ?? '0')
    const sumQAct = parseFloat(screen.getByTestId('sum-q-actual').textContent ?? '0')

    expect(sumQReq).toBeGreaterThan(0)
    expect(sumQAct).toBeGreaterThan(0)

    const row1Req = parseFloat(
      within(screen.getByTestId('results-row-r1')).getAllByRole('cell')[1].textContent ?? '0',
    )
    const row2Req = parseFloat(
      within(screen.getByTestId('results-row-r2')).getAllByRole('cell')[1].textContent ?? '0',
    )
    expect(Math.abs(sumQReq - (row1Req + row2Req))).toBeLessThanOrEqual(1)
  })

  it('marks a row insufficient when manual Q_nominal cannot cover Q_required', async () => {
    // Tiny room with big enclosure → high Q_required.
    // Manual equipment with low Q_ном can't cover it.
    const room = baseRoom('r1', 'Холодная', 40)
    useProjectStore.setState({ rooms: { r1: room }, roomOrder: ['r1'] })
    useEnclosureStore.getState().addEnclosure({
      roomId: 'r1',
      type: 'wall-ext',
      orientation: 'С',
      area: 30,
      kValue: 1.5,
      nCoeff: 1.0,
      nOverridden: false,
      adjacentRoomName: null,
      tAdjacent: null,
      perimeterOverride: null,
      zoneR: [2.1, 4.3, 8.6, 14.2],
      parentEnclosureId: null,
      constructionId: null,
    })
    useEquipmentStore.getState().addEquipment({
      roomId: 'r1',
      kind: 'bimetal',
      catalogModelId: null, // manual entry
      connection: 'side',
      installation: 'open',
      panelType: null,
      panelHeightMm: null,
      panelLengthMm: null,
      sectionsOverride: 1, // locked to 1 section → guaranteed too small
      convectorLengthMm: null,
      manualQNominal: 50, // very low — cannot cover
      manualNExponent: 1.3,
    })

    render(<EquipmentResultsTable />)
    await waitFor(() =>
      expect(screen.getByTestId('results-row-r1').getAttribute('data-insufficient')).toBe('true')
    )
    expect(screen.getByTestId('results-row-r1').className).toContain('--color-destructive')
  })
})

describe('EquipmentResultsTable — per-system LMTD (F01/F15)', () => {
  it('приборы из разных систем используют свои tSupply/tReturn', async () => {
    const rHot = baseRoom('r-hot', 'Горячая', 20)
    const rCool = baseRoom('r-cool', 'Холодная', 20)
    useProjectStore.setState({
      rooms: { 'r-hot': rHot, 'r-cool': rCool },
      roomOrder: ['r-hot', 'r-cool'],
    })

    // Identical enclosures → identical Q_required
    for (const rid of ['r-hot', 'r-cool']) {
      useEnclosureStore.getState().addEnclosure({
        roomId: rid, type: 'wall-ext', orientation: 'С', area: 12,
        kValue: 0.35, nCoeff: 1.0, nOverridden: false,
        adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
        zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null,
      })
    }

    // Two systems with different temperatures
    const sys1Id = useSystemStore.getState().addSystem({
      name: 'Горячая 90/70', schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'pe-x-16-2', coolantId: 'water',
      tSupply: 90, tReturn: 70, tSupplyUfh: 45, tReturnUfh: 35, sourceLabel: '',
    })
    const sys2Id = useSystemStore.getState().addSystem({
      name: 'Тёплая 55/45', schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'pe-x-16-2', coolantId: 'water',
      tSupply: 55, tReturn: 45, tSupplyUfh: 45, tReturnUfh: 35, sourceLabel: '',
    })

    // Fixed sections so Q_факт depends only on LMTD
    useEquipmentStore.getState().addEquipment({
      roomId: 'r-hot', systemId: sys1Id,
      kind: 'bimetal', catalogModelId: 'rifar-base-500', connection: 'side',
      installation: 'open', panelType: null, panelHeightMm: null, panelLengthMm: null,
      sectionsOverride: 5, convectorLengthMm: null, manualQNominal: null, manualNExponent: null,
    })
    useEquipmentStore.getState().addEquipment({
      roomId: 'r-cool', systemId: sys2Id,
      kind: 'bimetal', catalogModelId: 'rifar-base-500', connection: 'side',
      installation: 'open', panelType: null, panelHeightMm: null, panelLengthMm: null,
      sectionsOverride: 5, convectorLengthMm: null, manualQNominal: null, manualNExponent: null,
    })

    render(<EquipmentResultsTable />)
    await waitFor(() => {
      expect(within(screen.getByTestId('results-row-r-hot')).getAllByRole('cell')[4].textContent).not.toBe('—')
      expect(within(screen.getByTestId('results-row-r-cool')).getAllByRole('cell')[4].textContent).not.toBe('—')
    })

    const hotCells = within(screen.getByTestId('results-row-r-hot')).getAllByRole('cell')
    const coolCells = within(screen.getByTestId('results-row-r-cool')).getAllByRole('cell')

    // tDelta column reflects each system's temperatures
    expect(hotCells[2].textContent).toBe('90-70')
    expect(coolCells[2].textContent).toBe('55-45')

    // Higher LMTD (90/70) → higher Q_факт with same 5 sections
    const qHot = parseFloat(hotCells[4].textContent ?? '0')
    const qCool = parseFloat(coolCells[4].textContent ?? '0')
    expect(qHot).toBeGreaterThan(qCool)
  })
})
