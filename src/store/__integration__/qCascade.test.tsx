/**
 * Q-cascade integration tests (D-17).
 * RTL-level: render EquipmentRow and assert data-testid="q-required"
 * changes correctly when UFH loop state changes in ufhLoopStore.
 *
 * These tests verify the full data flow:
 *   ufhLoopStore + projectStore → EquipmentRow useMemo → DOM cell "q-required"
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
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

import { EquipmentRow } from '../../components/equipment/EquipmentRow'
import { useProjectStore } from '../projectStore'
import { useEnclosureStore } from '../enclosureStore'
import { useEquipmentStore } from '../equipmentStore'
import { useUfhLoopStore } from '../ufhLoopStore'
import type { Room } from '../../types/project'

// ---------------------------------------------------------------------------
// Helper: create a standard room + enclosures giving Q_пом > 0
// ---------------------------------------------------------------------------

function makeRoom(id: string, overrides: Partial<Room> = {}): Room {
  return {
    id,
    number: 1,
    name: 'Тестовая комната',
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
    ...overrides,
  }
}

/** Seeds enclosures giving a non-zero Q_пом for the given room. */
function seedEnclosures(roomId: string): void {
  useEnclosureStore.setState({
    enclosures: {
      [`${roomId}-w`]: {
        id: `${roomId}-w`, roomId, type: 'wall-ext', orientation: 'С',
        area: 12, kValue: 0.5, nCoeff: 1.0, nOverridden: false,
        adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
        zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null
      },
      [`${roomId}-win`]: {
        id: `${roomId}-win`, roomId, type: 'window', orientation: 'С',
        area: 2, kValue: 2.5, nCoeff: 1.0, nOverridden: false,
        adjacentRoomName: null, tAdjacent: null, perimeterOverride: null,
        zoneR: [2.1, 4.3, 8.6, 14.2], parentEnclosureId: null, constructionId: null
      },
    },
    enclosureOrder: [`${roomId}-w`, `${roomId}-win`],
  })
}

function renderRow(room: Room) {
  return render(
    <table><tbody>
      <EquipmentRow room={room} index={0} />
    </tbody></table>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Q-cascade integration (D-17)', () => {
  const room = makeRoom('r1')

  beforeEach(() => {
    useProjectStore.setState({
      city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
      tInside: 20,
      rooms: { r1: room },
      roomOrder: ['r1'],
      customCities: [],
      tSupply: 80,
      tReturn: 60,
      tSupplyUfh: 45,
      tReturnUfh: 35,
    })
    seedEnclosures('r1')
    useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('qRequired shows Q_пом when no UFH loop (Phase 3 behavior preserved)', async () => {
    renderRow(room)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const q = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(q).toBeGreaterThan(0)
  })

  it('qRequired shows Q_пом when UFH loop disabled', async () => {
    renderRow(room)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qFull = screen.getByTestId('q-required').textContent

    act(() => {
      const loopId = useUfhLoopStore.getState().addLoop({
        roomId: 'r1', enabled: true, activeAreaM2: 2, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
      useUfhLoopStore.getState().toggleEnabled(loopId)
    })

    const qAfterDisabled = screen.getByTestId('q-required').textContent
    expect(qAfterDisabled).toBe(qFull)
  })

  it('qRequired subtracts Q_тп when UFH enabled — D-17 cascade', async () => {
    renderRow(room)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qBefore = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'r1', enabled: true, activeAreaM2: 2, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })

    const qAfter = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(qAfter).toBeLessThan(qBefore)
  })

  it('qRequired clamped to 0 when Q_тп >= Q_пом (D-06)', async () => {
    renderRow(room)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))

    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'r1', enabled: true, activeAreaM2: 50, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })

    expect(screen.getByTestId('q-required').textContent).toBe('0')
  })

  it('qRequired toggles back to Q_пом when UFH loop re-disabled', async () => {
    let loopId = ''
    act(() => {
      loopId = useUfhLoopStore.getState().addLoop({
        roomId: 'r1', enabled: true, activeAreaM2: 2, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })

    renderRow(room)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qWithUfh = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useUfhLoopStore.getState().toggleEnabled(loopId)
    })

    const qWithoutUfh = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(qWithoutUfh).toBeGreaterThan(qWithUfh)
  })

  it('qRequired reacts to tSupplyUfh change', async () => {
    act(() => {
      useUfhLoopStore.getState().addLoop({
        roomId: 'r1', enabled: true, activeAreaM2: 2, covering: 'tile',
        pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3
      })
    })
    renderRow(room)
    await waitFor(() => expect(screen.getByTestId('q-required').textContent).not.toBe('—'))
    const qBefore = parseFloat(screen.getByTestId('q-required').textContent ?? '0')

    act(() => {
      useProjectStore.setState({ tSupplyUfh: 55 })
    })

    const qAfter = parseFloat(screen.getByTestId('q-required').textContent ?? '0')
    expect(qAfter).toBeLessThanOrEqual(qBefore)
  })
})
