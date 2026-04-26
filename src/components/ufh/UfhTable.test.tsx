/**
 * Tests for UfhTable component (Phase 04.1 Plan 06 — per-system).
 * Covers: filter loops by systemId, empty state, headers, add-loop CTA.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UfhTable } from './UfhTable'
import { useProjectStore } from '../../store/projectStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'
import { useSystemStore } from '../../store/systemStore'

// Mock UfhLoopRow to isolate table logic
vi.mock('./UfhLoopRow', () => ({
  UfhLoopRow: ({ room }: { room: { name: string } }) => (
    <tr data-testid={`ufh-loop-row-${room.name}`}>
      <td>{room.name}</td>
    </tr>
  ),
}))

const ROOM_1 = {
  id: 'room-1',
  number: 101,
  name: 'Гостиная',
  floor: 1,
  area: 20,
  height: 2.7,
  tInside: 20,
  isCorner: false,
  infiltrationMethod: 'rate' as const,
  nInfiltration: null,
  gapArea: null,
  windSpeed: null,
  lVentilation: 0,
}

const ROOM_2 = {
  id: 'room-2',
  number: 102,
  name: 'Спальня',
  floor: 1,
  area: 15,
  height: 2.7,
  tInside: 20,
  isCorner: false,
  infiltrationMethod: 'rate' as const,
  nInfiltration: null,
  gapArea: null,
  windSpeed: null,
  lVentilation: 0,
}

describe('UfhTable (per-system)', () => {
  let sysA = ''
  let sysB = ''

  beforeEach(() => {
    useSystemStore.setState({ systems: {}, systemOrder: [] })
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
    useProjectStore.setState({
      rooms: { 'room-1': ROOM_1, 'room-2': ROOM_2 },
      roomOrder: ['room-1', 'room-2'],
    })

    sysA = useSystemStore.getState().addSystem({
      name: 'Система А',
      schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'pe-x-16-2',
      coolantId: 'water',
      tSupply: 80,
      tReturn: 60,
      tSupplyUfh: 45,
      tReturnUfh: 35,
      sourceLabel: '',
    })
    sysB = useSystemStore.getState().addSystem({
      name: 'Система Б',
      schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'pe-x-16-2',
      coolantId: 'water',
      tSupply: 60,
      tReturn: 40,
      tSupplyUfh: 40,
      tReturnUfh: 30,
      sourceLabel: '',
    })
  })

  it('рендерит loops только из переданного systemId', () => {
    useUfhLoopStore.getState().addLoop({
      roomId: 'room-1', systemId: sysA, enabled: true, activeAreaM2: 16,
      covering: 'tile', pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
    })
    useUfhLoopStore.getState().addLoop({
      roomId: 'room-2', systemId: sysB, enabled: true, activeAreaM2: 12,
      covering: 'tile', pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
    })

    render(<UfhTable systemId={sysA} />)
    expect(screen.getByTestId('ufh-loop-row-Гостиная')).toBeInTheDocument()
    expect(screen.queryByTestId('ufh-loop-row-Спальня')).not.toBeInTheDocument()
  })

  it('empty state когда в системе нет loops', () => {
    render(<UfhTable systemId={sysA} />)
    expect(screen.getByText(/В этой системе нет контуров тёплого пола/i)).toBeInTheDocument()
  })

  it('показывает заголовки таблицы', () => {
    useUfhLoopStore.getState().addLoop({
      roomId: 'room-1', systemId: sysA, enabled: true, activeAreaM2: 16,
      covering: 'tile', pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
    })
    render(<UfhTable systemId={sysA} />)
    expect(screen.getByText('Помещение')).toBeInTheDocument()
    expect(screen.getByText('F_тп, м²')).toBeInTheDocument()
    expect(screen.getByText('Покрытие')).toBeInTheDocument()
    expect(screen.getByText('Труба ТП')).toBeInTheDocument()
    expect(screen.getByText('Шаг, см')).toBeInTheDocument()
    expect(screen.getByText('q, Вт/м²')).toBeInTheDocument()
  })

  it('CTA "Добавить контур" доступна при пустом состоянии', () => {
    render(<UfhTable systemId={sysA} />)
    expect(screen.getByRole('button', { name: /добавить контур/i })).toBeInTheDocument()
  })

  // RED tests from plan 05/06 RED scaffold — per-system filtering behavior.
  it('loop из другой системы не рендерится', () => {
    useUfhLoopStore.getState().addLoop({
      roomId: 'room-1', systemId: sysB, enabled: true, activeAreaM2: 16,
      covering: 'tile', pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
    })
    render(<UfhTable systemId={sysA} />)
    expect(screen.getByText(/В этой системе нет контуров/i)).toBeInTheDocument()
  })
})
