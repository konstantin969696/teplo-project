/**
 * Integration tests for EquipmentRow (room-scoped).
 * Verify: derived Q_пом (D-07), reactivity to store changes, multi-equipment
 * summing via qActualSum. Post-refactor: per-equipment fields live in
 * EquipmentSubRow (inside the expanded sub-table) so assertions here use the
 * summary-level testids q-required / q-actual-sum / surplus-pct.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
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

import { EquipmentRow } from './EquipmentRow'
import { useProjectStore } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'
import { useSystemStore } from '../../store/systemStore'
import type { Room } from '../../types/project'

/** Helper: создать дефолтную систему и привязать к ней все текущие equipment/ufhLoops. */
function setupDefaultSystem(opts: { tSupply?: number; tReturn?: number; tSupplyUfh?: number; tReturnUfh?: number } = {}): string {
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  const id = useSystemStore.getState().addSystem({
    name: 'Система 1',
    schemaType: 'two-pipe-dead-end',
    pipeMaterialId: 'pe-x-16-2',
    coolantId: 'water',
    tSupply: opts.tSupply ?? 80,
    tReturn: opts.tReturn ?? 60,
    tSupplyUfh: opts.tSupplyUfh ?? 45,
    tReturnUfh: opts.tReturnUfh ?? 35,
    sourceLabel: '',
  })
  return id
}

/** Helper: привязать все existing equipment и ufhLoops к первой системе. */
function bindAllToDefaultSystem() {
  const sysId = useSystemStore.getState().systemOrder[0]
  if (!sysId) return
  useEquipmentStore.getState().bulkSetSystemId(sysId)
  useUfhLoopStore.getState().bulkSetSystemId(sysId)
}

function renderRow(room: Room) {
  return render(
    <table>
      <tbody>
        <EquipmentRow room={room} index={0} />
      </tbody>
    </table>
  )
}

const baseRoom: Room = {
  id: 'room-A',
  number: 101,
  name: 'Гостиная',
  floor: 1,
  area: 20,
  height: 2.7,
  isCorner: false,
  infiltrationMethod: 'rate',
  nInfiltration: 0.5,
  gapArea: null,
  windSpeed: null,
  lVentilation: 0,
  tInside: 20,
}

describe('EquipmentRow integration', () => {
  beforeEach(() => {
    useProjectStore.setState({
      city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
      tInside: 20,
      rooms: { 'room-A': baseRoom },
      roomOrder: ['room-A'],
      customCities: [],
    })
    useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
    useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
    setupDefaultSystem()

    useEnclosureStore.getState().addEnclosure({
      roomId: 'room-A',
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
  })

  it('recomputes qRequired when enclosure area changes', async () => {
    useEquipmentStore.getState().addEquipment({
      roomId: 'room-A',
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
    bindAllToDefaultSystem()

    renderRow(baseRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const before = screen.getByTestId('q-required').textContent

    const enclosureId = useEnclosureStore.getState().enclosureOrder[0]
    await act(async () => {
      useEnclosureStore.getState().updateEnclosure(enclosureId!, { area: 24 })
    })

    const after = screen.getByTestId('q-required').textContent
    expect(after).not.toBe(before)
    expect(parseFloat(after ?? '0')).toBeGreaterThan(parseFloat(before ?? '0'))
  })

  it('recomputes Σ Q_факт when tSupply changes in projectStore', async () => {
    useEquipmentStore.getState().addEquipment({
      roomId: 'room-A',
      kind: 'bimetal',
      catalogModelId: 'rifar-base-500',
      connection: 'side',
      installation: 'open',
      panelType: null,
      panelHeightMm: null,
      panelLengthMm: null,
      sectionsOverride: 5, // fixed sections so changing tSupply shows the effect
      convectorLengthMm: null,
      manualQNominal: null,
      manualNExponent: null,
    })
    bindAllToDefaultSystem()

    renderRow(baseRoom)
    await waitFor(() => expect(screen.getByTestId('q-actual-sum').textContent).not.toBe('—'))
    const before = screen.getByTestId('q-actual-sum').textContent

    act(() => {
      const sysId = useSystemStore.getState().systemOrder[0]!
      useSystemStore.getState().updateSystem(sysId, { tSupply: 55 })
    })

    const after = screen.getByTestId('q-actual-sum').textContent
    expect(after).not.toBe(before)
  })

  it('recomputes Σ Q_факт and surplusPct when equipment.connection changes', async () => {
    const id = useEquipmentStore.getState().addEquipment({
      roomId: 'room-A',
      kind: 'bimetal',
      catalogModelId: 'rifar-base-500',
      connection: 'side',
      installation: 'open',
      panelType: null,
      panelHeightMm: null,
      panelLengthMm: null,
      sectionsOverride: 5,
      convectorLengthMm: null,
      manualQNominal: null,
      manualNExponent: null,
    })
    bindAllToDefaultSystem()

    renderRow(baseRoom)
    await waitFor(() => expect(screen.getByTestId('q-actual-sum').textContent).not.toBe('—'))
    const qBefore = screen.getByTestId('q-actual-sum').textContent
    const sBefore = screen.getByTestId('surplus-pct').textContent

    act(() => {
      useEquipmentStore.getState().updateEquipment(id, { connection: 'bottom' })
    })

    const qAfter = screen.getByTestId('q-actual-sum').textContent
    const sAfter = screen.getByTestId('surplus-pct').textContent
    expect(qAfter).not.toBe(qBefore)
    expect(sAfter).not.toBe(sBefore)
    expect(parseFloat(qAfter ?? '0')).toBeLessThan(parseFloat(qBefore ?? '0'))
  })

  it('shows em-dash in Σ Q_факт column after all equipment deleted', async () => {
    const id = useEquipmentStore.getState().addEquipment({
      roomId: 'room-A',
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
    bindAllToDefaultSystem()

    renderRow(baseRoom)
    await waitFor(() => expect(screen.getByTestId('q-actual-sum').textContent).not.toBe('—'))
    expect(screen.getByTestId('equipment-count').textContent).toBe('1')

    act(() => {
      useEquipmentStore.getState().deleteEquipment(id)
    })

    expect(screen.getByTestId('equipment-count').textContent).toBe('—')
    expect(screen.getByTestId('q-actual-sum').textContent).toBe('—')
    expect(screen.getByText(/Гостиная/)).toBeInTheDocument()
  })
})

// ============================================================
// Phase 4: D-17 Q-cascade tests
// ============================================================

const ufhRoom: Room = {
  id: 'room-UFH',
  number: 201,
  name: 'Ванная',
  floor: 1,
  area: 10,
  height: 2.5,
  isCorner: false,
  infiltrationMethod: 'rate',
  nInfiltration: 0.5,
  gapArea: null,
  windSpeed: null,
  lVentilation: 0,
  tInside: 20,
}

describe('ufh cascade (D-17)', () => {
  beforeEach(() => {
    useProjectStore.setState({
      city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
      tInside: 20,
      rooms: { 'room-UFH': ufhRoom },
      roomOrder: ['room-UFH'],
      customCities: [],
    })
    setupDefaultSystem()
    // Enclosures giving meaningful Q_пом > 0
    useEnclosureStore.setState({
      enclosures: {
        'enc-w': {
          id: 'enc-w', roomId: 'room-UFH', type: 'wall-ext', orientation: 'С',
          area: 10, kValue: 0.5, nCoeff: 1.0, nOverridden: false,
          adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
          zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null
        },
        'enc-win': {
          id: 'enc-win', roomId: 'room-UFH', type: 'window', orientation: 'С',
          area: 2, kValue: 2.5, nCoeff: 1.0, nOverridden: false,
          adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
          zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null
        },
      },
      enclosureOrder: ['enc-w', 'enc-win'],
    })
    useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('qRequired equals Q_пом when no UFH loop exists', async () => {
    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const text = screen.getByTestId('q-required').textContent
    expect(parseFloat(text ?? '0')).toBeGreaterThan(0)
  })

  it('qRequired equals Q_пом when UFH loop exists but is disabled', async () => {
    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qWithoutUfh = screen.getByTestId('q-required').textContent

    act(() => {
      const loopId = useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 1, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
      useUfhLoopStore.getState().toggleEnabled(loopId)
    })

    const qAfter = screen.getByTestId('q-required').textContent
    expect(qAfter).toBe(qWithoutUfh)
  })

  it('qRequired subtracts Q_тп when UFH enabled', async () => {
    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qRoom = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 1, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })

    const qAfter = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(qAfter).toBeLessThan(qRoom)
  })

  it('qRequired clamped to 0 when Q_тп >= Q_пом', async () => {
    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))

    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 50, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })

    const qAfter = screen.getByTestId('q-required').textContent
    expect(qAfter?.startsWith('0')).toBe(true)
  })

  it('qRequired increases when UFH loop is toggled off', async () => {
    let loopId = ''
    act(() => {
      loopId = useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 1, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })
    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qWithUfh = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useUfhLoopStore.getState().toggleEnabled(loopId)
    })

    const qWithoutUfh = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(qWithoutUfh).toBeGreaterThan(qWithUfh)
  })
})

// ============================================================
// Phase comfort-UFH: comfort-контуры не вычитаются из qResidual
// ============================================================

describe('ufh cascade — comfort mode (Phase 4)', () => {
  beforeEach(() => {
    useProjectStore.setState({
      city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
      tInside: 20,
      rooms: { 'room-UFH': ufhRoom },
      roomOrder: ['room-UFH'],
      customCities: [],
    })
    setupDefaultSystem()
    useEnclosureStore.setState({
      enclosures: {
        'enc-w': {
          id: 'enc-w', roomId: 'room-UFH', type: 'wall-ext', orientation: 'С',
          area: 10, kValue: 0.5, nCoeff: 1.0, nOverridden: false,
          adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
          zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null
        },
      },
      enclosureOrder: ['enc-w'],
    })
    useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('comfort-контур НЕ вычитается из qRequired', async () => {
    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qRoomOnly = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 8, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
        mode: 'comfort', targetFloorTempC: 30,
      })
    })

    await waitFor(() => {
      const text = screen.getByTestId('q-required').textContent
      expect(text).not.toBe('—')
    })
    const qWithComfort = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(qWithComfort).toBeCloseTo(qRoomOnly, 0)
  })

  it('heating-контур по-прежнему вычитается из qRequired', async () => {
    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qRoomOnly = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 8, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
        mode: 'heating',
      })
    })

    const qWithHeating = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(qWithHeating).toBeLessThan(qRoomOnly)
  })

  it('comfort-контур: отображается строка "вне баланса"', async () => {
    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 8, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
        mode: 'comfort', targetFloorTempC: 30,
      })
    })

    renderRow(ufhRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))

    const comfortEl = screen.getByTestId('q-ufh-comfort')
    expect(comfortEl).toBeInTheDocument()
    expect(comfortEl.textContent).toMatch(/вне баланса/i)
    const match = (comfortEl.textContent ?? '').match(/\d+/)
    expect(match).not.toBeNull()
    expect(parseInt(match![0], 10)).toBeGreaterThan(0)
  })
})

// ============================================================
// Phase pool-evaporation: Q_исп отображается в EquipmentRow
// ============================================================

const poolRoom: Room = {
  id: 'room-POOL',
  number: 301,
  name: 'Бассейн',
  floor: 1,
  area: 50,
  height: 3.5,
  isCorner: false,
  infiltrationMethod: 'rate',
  nInfiltration: 0.5,
  gapArea: null,
  windSpeed: null,
  lVentilation: 0,
  tInside: 28,
  poolParams: { enabled: true, fMirrorM2: 50, tWaterC: 28, phi: 0.6, mode: 'active' },
}

describe('pool evaporation — EquipmentRow (Phase 4 pool)', () => {
  beforeEach(() => {
    useProjectStore.setState({
      city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
      tInside: 28,
      rooms: { 'room-POOL': poolRoom },
      roomOrder: ['room-POOL'],
      customCities: [],
    })
    setupDefaultSystem()
    useEnclosureStore.setState({
      enclosures: {
        'enc-pool-w': {
          id: 'enc-pool-w', roomId: 'room-POOL', type: 'wall-ext', orientation: 'С',
          area: 15, kValue: 0.4, nCoeff: 1.0, nOverridden: false,
          adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
          zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null
        },
      },
      enclosureOrder: ['enc-pool-w'],
    })
    useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('комната с бассейном → строка "Испарение" видна', async () => {
    renderRow(poolRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    expect(screen.getByTestId('q-evaporation')).toBeInTheDocument()
    expect(screen.getByTestId('q-evaporation').textContent).toMatch(/Испарение/)
    const match = (screen.getByTestId('q-evaporation').textContent ?? '').match(/\d+/)
    expect(match).not.toBeNull()
    expect(parseInt(match![0], 10)).toBeGreaterThan(0)
  })

  it('комната без бассейна → строки "Испарение" нет', async () => {
    const noPoolRoom = { ...poolRoom, poolParams: undefined }
    useProjectStore.setState({ rooms: { 'room-POOL': noPoolRoom }, roomOrder: ['room-POOL'] })
    renderRow(noPoolRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    expect(screen.queryByTestId('q-evaporation')).not.toBeInTheDocument()
  })

  it('Q_исп включён в qRoom → qRequired с бассейном > без бассейна', async () => {
    const noPoolRoom = { ...poolRoom, poolParams: undefined }
    useProjectStore.setState({ rooms: { 'room-POOL': noPoolRoom }, roomOrder: ['room-POOL'] })
    const { unmount } = renderRow(noPoolRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qWithoutPool = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    unmount()

    useProjectStore.setState({ rooms: { 'room-POOL': poolRoom }, roomOrder: ['room-POOL'] })
    renderRow(poolRoom)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qWithPool = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    expect(qWithPool).toBeGreaterThan(qWithoutPool)
  })
})
