/**
 * Phase 05 — SummaryTab smoke tests.
 * Verifies: render on empty state, render with rooms+system, totals math.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { calculateRoomTotals } from '../../engine/heatLoss'

// Mock engine worker -- real Worker is not available in jsdom. Stub uses the
// same pure functions synchronously so SummaryTab gets correct results.
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

import { SummaryTab } from './SummaryTab'
import { useProjectStore } from '../../store/projectStore'
import { useSystemStore } from '../../store/systemStore'
import { useEnclosureStore } from '../../store/enclosureStore'

beforeEach(() => {
  localStorage.clear()
  // Reset persisted store state to defaults.
  useProjectStore.setState({
    city: null,
    tInside: 20,
    rooms: {},
    roomOrder: [],
    customCities: [],
    schemaVersion: '1.1'
  } as Parameters<typeof useProjectStore.setState>[0])
  useSystemStore.setState({ systems: {}, systemOrder: [] } as Parameters<typeof useSystemStore.setState>[0])
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] } as Parameters<typeof useEnclosureStore.setState>[0])
})

describe('SummaryTab', () => {
  it('shows hint when no rooms / systems / equipment / loops', () => {
    render(<SummaryTab />)
    expect(screen.getByText(/появится сводка по объекту/i)).toBeTruthy()
  })

  it('renders project header and rooms table when filled', async () => {
    useProjectStore.setState({
      city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
      tInside: 20,
      rooms: {
        'r1': {
          id: 'r1', number: 1, name: 'Гостиная', floor: 1, area: 20, height: 2.7,
          isCorner: false, infiltrationMethod: 'rate', nInfiltration: 0.5,
          gapArea: null, windSpeed: null, lVentilation: 0, tInside: 20
        }
      },
      roomOrder: ['r1']
    } as Parameters<typeof useProjectStore.setState>[0])

    render(<SummaryTab />)
    // heatLoss считается через worker (async) -- ждём появления секции.
    expect(await screen.findByText('Теплопотери')).toBeTruthy()
    expect(screen.getByText('Объект')).toBeTruthy()
    expect(screen.getByText('Москва')).toBeTruthy()
    expect(screen.getByText('Гостиная')).toBeTruthy()
    expect(screen.getByText(/Итого по объекту:/i)).toBeTruthy()
  })

  it('renders systems section when systemStore has entries', () => {
    useSystemStore.setState({
      systems: {
        's1': {
          id: 's1', name: 'Система 1',
          schemaType: 'two-pipe-dead-end',
          pipeMaterialId: 'steel-vgp-dn20',
          coolantId: 'water',
          tSupply: 80, tReturn: 60, tSupplyUfh: 45, tReturnUfh: 35,
          sourceLabel: ''
        }
      },
      systemOrder: ['s1']
    } as Parameters<typeof useSystemStore.setState>[0])

    render(<SummaryTab />)
    expect(screen.getByText('Системы отопления')).toBeTruthy()
    expect(screen.getByText('Система 1')).toBeTruthy()
    expect(screen.getByText('Двухтруб. тупиковая')).toBeTruthy()
  })
})
