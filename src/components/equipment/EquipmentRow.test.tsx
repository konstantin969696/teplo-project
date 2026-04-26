/**
 * Integration tests for EquipmentRow (room-scoped).
 * Verify: derived Q_пом (D-07), reactivity to store changes, multi-equipment
 * summing via qActualSum. Post-refactor: per-equipment fields live in
 * EquipmentSubRow (inside the expanded sub-table) so assertions here use the
 * summary-level testids q-required / q-actual-sum / surplus-pct.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
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

  it('recomputes qRequired when enclosure area changes', () => {
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
    const before = screen.getByTestId('q-required').textContent

    const enclosureId = useEnclosureStore.getState().enclosureOrder[0]
    act(() => {
      useEnclosureStore.getState().updateEnclosure(enclosureId!, { area: 24 })
    })

    const after = screen.getByTestId('q-required').textContent
    expect(after).not.toBe(before)
    expect(parseFloat(after ?? '0')).toBeGreaterThan(parseFloat(before ?? '0'))
  })

  it('recomputes Σ Q_факт when tSupply changes in projectStore', () => {
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
    const before = screen.getByTestId('q-actual-sum').textContent

    act(() => {
      const sysId = useSystemStore.getState().systemOrder[0]!
      useSystemStore.getState().updateSystem(sysId, { tSupply: 55 })
    })

    const after = screen.getByTestId('q-actual-sum').textContent
    expect(after).not.toBe(before)
  })

  it('recomputes Σ Q_факт and surplusPct when equipment.connection changes', () => {
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

  it('shows em-dash in Σ Q_факт column after all equipment deleted', () => {
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
    // before delete: equipment-count shows "1"
    expect(screen.getByTestId('equipment-count').textContent).toBe('1')
    const beforeSum = screen.getByTestId('q-actual-sum').textContent
    expect(beforeSum).not.toBe('—')

    act(() => {
      useEquipmentStore.getState().deleteEquipment(id)
    })

    expect(screen.getByTestId('equipment-count').textContent).toBe('—')
    expect(screen.getByTestId('q-actual-sum').textContent).toBe('—')
    // Room name still rendered because Q_пом doesn't depend on equipment
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

  it('qRequired equals Q_пом when no UFH loop exists', () => {
    renderRow(ufhRoom)
    // No UFH loop → qRequired = Q_пом (Phase 3 behavior preserved)
    const text = screen.getByTestId('q-required').textContent
    expect(text).not.toBe('—')
    expect(parseFloat(text ?? '0')).toBeGreaterThan(0)
  })

  it('qRequired equals Q_пом when UFH loop exists but is disabled', () => {
    renderRow(ufhRoom)
    const qWithoutUfh = screen.getByTestId('q-required').textContent

    act(() => {
      const loopId = useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 1, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
      useUfhLoopStore.getState().toggleEnabled(loopId) // disable it
    })

    const qAfter = screen.getByTestId('q-required').textContent
    // disabled UFH → same as without UFH
    expect(qAfter).toBe(qWithoutUfh)
  })

  it('qRequired subtracts Q_тп when UFH enabled', () => {
    renderRow(ufhRoom)
    const qRoomText = screen.getByTestId('q-required').textContent
    const qRoom = parseFloat(qRoomText ?? '0')

    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 1, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })

    const qAfter = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    // With UFH enabled, qRequired should be LESS than qRoom (UFH covers some load)
    expect(qAfter).toBeLessThan(qRoom)
  })

  it('qRequired clamped to 0 when Q_тп >= Q_пом', () => {
    renderRow(ufhRoom)

    act(() => {
      // Large area: 50m² * 215W/m² >> Q_пом (~500W) → clamp to 0
      useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 50, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })

    const qAfter = screen.getByTestId('q-required').textContent
    // Accept '0' или '0(ТП)' — последний отмечает что ТП покрыл теплопотери (UX hint).
    expect(qAfter?.startsWith('0')).toBe(true)
  })

  it('qRequired increases when UFH loop is toggled off', () => {
    let loopId = ''
    act(() => {
      loopId = useUfhLoopStore.getState().addLoop({
        roomId: 'room-UFH', enabled: true, activeAreaM2: 1, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })
    renderRow(ufhRoom)
    const qWithUfh = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useUfhLoopStore.getState().toggleEnabled(loopId)
    })

    const qWithoutUfh = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    // Toggling off restores higher value
    expect(qWithoutUfh).toBeGreaterThan(qWithUfh)
  })
})
