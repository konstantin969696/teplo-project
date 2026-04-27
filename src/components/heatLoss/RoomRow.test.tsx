/**
 * Integration tests for RoomRow Copy button.
 * Verify: click Copy → new room appears via cloneRoom; click does NOT toggle
 * row expansion (stopPropagation on the action button).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { RoomRow } from './RoomRow'
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

const sourceRoom: Room = {
  id: 'room-src',
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

function renderRow(room: Room) {
  return render(
    <table>
      <tbody>
        <RoomRow room={room} index={0} tOutside={-25} />
      </tbody>
    </table>
  )
}

beforeEach(() => {
  useProjectStore.setState({
    city: { name: 'Москва', tOutside: -25, gsop: 4943, humidityZone: 'Б' },
    tInside: 20,
    rooms: { 'room-src': sourceRoom },
    roomOrder: ['room-src'],
    customCities: [],
    tSupply: 80,
    tReturn: 60,
  })
  useEnclosureStore.setState({ enclosures: {}, enclosureOrder: [] })
  useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
})

describe('RoomRow Copy button', () => {
  it('клик по Copy клонирует комнату и новая комната появляется в projectStore', () => {
    renderRow(sourceRoom)

    expect(useProjectStore.getState().roomOrder).toHaveLength(1)

    const copyButton = screen.getByRole('button', {
      name: /Клонировать помещение Гостиная/,
    })
    fireEvent.click(copyButton)

    const { rooms, roomOrder } = useProjectStore.getState()
    expect(roomOrder).toHaveLength(2)
    const newId = roomOrder.find(id => id !== 'room-src')!
    expect(rooms[newId].name).toBe('Гостиная (копия)')
    expect(rooms[newId].floor).toBe(1)
    expect(rooms[newId].number).toBe(102)
  })

  it('клик по Copy не разворачивает строку (stopPropagation)', () => {
    renderRow(sourceRoom)

    const tr = screen.getByRole('row')
    // initial state
    expect(tr.getAttribute('aria-expanded')).toBe('false')

    const copyButton = screen.getByRole('button', {
      name: /Клонировать помещение Гостиная/,
    })
    fireEvent.click(copyButton)

    // всё ещё свёрнута
    expect(tr.getAttribute('aria-expanded')).toBe('false')
  })

  it('клик по остальной части строки по-прежнему разворачивает её', () => {
    renderRow(sourceRoom)

    const tr = screen.getByRole('row')
    expect(tr.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(tr)
    expect(tr.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('PoolSection in RoomRow', () => {
  it('checkbox "Бассейн" не виден пока строка не развёрнута', () => {
    renderRow(sourceRoom)
    expect(screen.queryByLabelText('Бассейн в помещении')).not.toBeInTheDocument()
  })

  it('разворачиваем строку → чекбокс "Бассейн в помещении" виден и не отмечен', () => {
    renderRow(sourceRoom)
    fireEvent.click(screen.getByRole('row'))
    const cb = screen.getByLabelText('Бассейн в помещении')
    expect(cb).toBeInTheDocument()
    expect(cb).not.toBeChecked()
  })

  it('отмечаем checkbox → poolParams появляется в store с defaults', () => {
    renderRow(sourceRoom)
    fireEvent.click(screen.getByRole('row'))
    fireEvent.click(screen.getByLabelText('Бассейн в помещении'))
    const updated = useProjectStore.getState().rooms['room-src']
    expect(updated.poolParams).toBeDefined()
    expect(updated.poolParams?.enabled).toBe(true)
    expect(updated.poolParams?.tWaterC).toBe(28)
    expect(updated.poolParams?.phi).toBe(0.6)
    expect(updated.poolParams?.mode).toBe('active')
  })

  it('снимаем checkbox → poolParams удаляется из store', () => {
    const roomWithPool = {
      ...sourceRoom,
      poolParams: { enabled: true, fMirrorM2: 50, tWaterC: 28, phi: 0.6, mode: 'active' as const },
    }
    useProjectStore.setState({ rooms: { 'room-src': roomWithPool }, roomOrder: ['room-src'] })
    renderRow(roomWithPool)
    fireEvent.click(screen.getAllByRole('row')[0])
    const cb = screen.getByLabelText('Бассейн в помещении')
    expect(cb).toBeChecked()
    fireEvent.click(cb)
    expect(useProjectStore.getState().rooms['room-src'].poolParams).toBeUndefined()
  })
})
