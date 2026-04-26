/**
 * Integration tests for RoomsTable / FloorFooterRow.
 * Verify: footer rendered per expanded floor group; count input + button add rooms
 * via addRoomsToFloor (count clamped 1..50, tied to correct floor).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { RoomsTable } from './RoomsTable'
import { useProjectStore } from '../../store/projectStore'
import { useEnclosureStore } from '../../store/enclosureStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import type { Room } from '../../types/project'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

function makeRoom(id: string, floor: number, number: number, name = ''): Room {
  return {
    id,
    number,
    name,
    floor,
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
}

beforeEach(() => {
  useProjectStore.setState({
    city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
    tInside: 20,
    rooms: {},
    roomOrder: [],
    customCities: [],
    tSupply: 80,
    tReturn: 60,
  })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
})

describe('RoomsTable FloorFooterRow', () => {
  it('рендерит футер «Добавить помещение» для каждого раскрытого этажа', () => {
    const r1 = makeRoom('r1', 1, 101)
    const r2 = makeRoom('r2', 2, 201)
    useProjectStore.setState({
      rooms: { r1, r2 },
      roomOrder: ['r1', 'r2'],
    })

    render(
      <RoomsTable
        rooms={{ r1, r2 }}
        roomOrder={['r1', 'r2']}
        tOutside={-25}
      />
    )

    // по кнопке «Добавить помещение» — две (по одной на этаж)
    // Русская плюрализация: 1 → «помещение», 2-4 → «помещения», 5+ → «помещений»
    const buttons = screen.getAllByRole('button', { name: /Добавить \d+ помещени[ея]?й? на этаж/ })
    expect(buttons).toHaveLength(2)
  })

  it('клик по кнопке «Добавить помещение» добавляет 1 комнату на этот этаж', () => {
    const r1 = makeRoom('r1', 3, 301)
    useProjectStore.setState({ rooms: { r1 }, roomOrder: ['r1'] })

    render(
      <RoomsTable
        rooms={{ r1 }}
        roomOrder={['r1']}
        tOutside={-25}
      />
    )

    const button = screen.getByRole('button', { name: /Добавить 1 помещение на этаж 3/ })
    fireEvent.click(button)

    const { rooms, roomOrder } = useProjectStore.getState()
    expect(roomOrder).toHaveLength(2)
    const newRoomId = roomOrder.find(id => id !== 'r1')!
    expect(rooms[newRoomId].floor).toBe(3)
    expect(rooms[newRoomId].number).toBe(302)
  })

  it('изменение input-а «Сколько» и клик добавляют указанное число комнат', () => {
    const r1 = makeRoom('r1', 1, 101)
    useProjectStore.setState({ rooms: { r1 }, roomOrder: ['r1'] })

    render(
      <RoomsTable
        rooms={{ r1 }}
        roomOrder={['r1']}
        tOutside={-25}
      />
    )

    const countInput = screen.getByLabelText(/Количество добавляемых помещений на этаж 1/)
    fireEvent.change(countInput, { target: { value: '5' } })

    // подпись кнопки обновилась: "... ×5" (5 → «помещений»)
    const button = screen.getByRole('button', { name: /Добавить 5 помещений на этаж 1/ })
    fireEvent.click(button)

    expect(useProjectStore.getState().roomOrder).toHaveLength(6) // 1 исходная + 5 новых
    const newOnFloor = Object.values(useProjectStore.getState().rooms)
      .filter(r => r.floor === 1 && r.id !== 'r1')
      .map(r => r.number)
      .sort((a, b) => a - b)
    expect(newOnFloor).toEqual([102, 103, 104, 105, 106])
  })

  it('клампит значение 100 до 50 при сабмите', () => {
    const r1 = makeRoom('r1', 1, 101)
    useProjectStore.setState({ rooms: { r1 }, roomOrder: ['r1'] })

    render(
      <RoomsTable
        rooms={{ r1 }}
        roomOrder={['r1']}
        tOutside={-25}
      />
    )

    const countInput = screen.getByLabelText(/Количество добавляемых помещений на этаж 1/)
    fireEvent.change(countInput, { target: { value: '100' } })

    // Находим кнопку по её видимому тексту (aria-label с count=100 нестабилен в jsdom).
    const button = screen
      .getAllByRole('button')
      .find(b => b.textContent?.includes('Добавить помещение'))!
    expect(button).toBeDefined()
    fireEvent.click(button)

    // Итого в сторе: 1 исходная + 50 новых (кламп)
    expect(useProjectStore.getState().roomOrder).toHaveLength(51)
  })

  it('футер правильного этажа привязан к своему этажу (не трогает соседний)', () => {
    const r1 = makeRoom('r1', 1, 101)
    const r2 = makeRoom('r2', 2, 201)
    useProjectStore.setState({
      rooms: { r1, r2 },
      roomOrder: ['r1', 'r2'],
    })

    render(
      <RoomsTable
        rooms={{ r1, r2 }}
        roomOrder={['r1', 'r2']}
        tOutside={-25}
      />
    )

    const floor2Button = screen.getByRole('button', { name: /Добавить 1 помещение на этаж 2/ })
    fireEvent.click(floor2Button)

    const state = useProjectStore.getState()
    const floor1Count = Object.values(state.rooms).filter(r => r.floor === 1).length
    const floor2Count = Object.values(state.rooms).filter(r => r.floor === 2).length

    expect(floor1Count).toBe(1) // не тронули
    expect(floor2Count).toBe(2) // добавили одну
  })
})
