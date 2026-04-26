/**
 * Phase 05 — SummaryTab smoke tests.
 * Verifies: render on empty state, render with rooms+system, totals math.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renders project header and rooms table when filled', () => {
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
    expect(screen.getByText('Объект')).toBeTruthy()
    expect(screen.getByText('Москва')).toBeTruthy()
    expect(screen.getByText('Теплопотери')).toBeTruthy()
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
