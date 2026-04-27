/**
 * Tests for UfhLoopDetails comfort-mode rendering and mode switcher.
 * Covers: heating-default (no banner), comfort with valid target (banner + temps),
 * comfort-impossible fallback (warn banner), Phase 3 mode switcher UI.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UfhLoopDetails } from './UfhLoopDetails'
import { useSystemStore } from '../../store/systemStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'
import { calculateRequiredCoolantMeanTemp } from '../../engine/ufh'
import type { Room } from '../../types/project'
import type { UfhLoop } from '../../types/hydraulics'

vi.mock('../../hooks/useUfhSystemTemps', () => ({
  useUfhSystemTemps: () => ({ tSupply: 45, tReturn: 35 }),
}))

vi.mock('../../workers/useEngineWorker', () => ({
  getEngineWorker: () => ({ heatLossForRooms: async () => [] }),
}))

const ROOM: Room = {
  id: 'room-1',
  name: 'Бассейн',
  floor: 1,
  number: 1,
  area: 40,
  height: 3.5,
  tInside: 25,
  isCorner: false,
  infiltrationMethod: 'rate',
  nInfiltration: null,
  gapArea: null,
  windSpeed: null,
  lVentilation: 0,
}

const COMMON_PROPS = {
  qPerM2: 108,
  qTpW: 3456,
  floorTempC: 35,
  qRoomW: 4000,
  threshold: 33,
  isBathroom: false,
}

function setupSystem(): string {
  useSystemStore.setState({ systems: {}, systemOrder: [] })
  return useSystemStore.getState().addSystem({
    name: 'Система 1',
    schemaType: 'two-pipe-dead-end',
    pipeMaterialId: 'pe-x-16-2',
    coolantId: 'water',
    tSupply: 80,
    tReturn: 60,
    tSupplyUfh: 45,
    tReturnUfh: 35,
    sourceLabel: '',
  })
}

function makeLoop(systemId: string, overrides?: Partial<UfhLoop>): UfhLoop {
  return {
    id: 'loop-1',
    roomId: 'room-1',
    systemId,
    enabled: true,
    activeAreaM2: 32,
    covering: 'tile',
    pipeId: 'pe-x-16-2',
    stepCm: 20,
    leadInM: 3,
    mode: 'heating',
    targetFloorTempC: null,
    ...overrides,
  }
}

describe('UfhLoopDetails — heating mode (no banner)', () => {
  it('не показывает comfort-banner для mode=heating', () => {
    const sysId = setupSystem()
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={makeLoop(sysId)} />)
    expect(screen.queryByText(/Комфорт-режим/i)).not.toBeInTheDocument()
  })

  it('показывает ΔP_конт в деталях', () => {
    const sysId = setupSystem()
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={makeLoop(sysId)} />)
    expect(screen.getByText(/ΔP_конт/i)).toBeInTheDocument()
  })
})

describe('UfhLoopDetails — comfort mode с valid targetFloorTempC', () => {
  it('показывает comfort banner с подобранными температурами (фактическая t_пола ≠ цель)', () => {
    // COMMON_PROPS.floorTempC=35, targetFloorTempC=30 → разница 5°C > 0.1 → ветка "фактическая"
    const sysId = setupSystem()
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 30 })

    const tMean = calculateRequiredCoolantMeanTemp(30, ROOM.tInside, 'tile')!
    const dt = 10 // 45-35
    const tSupEff = tMean + dt / 2
    const tRetEff = tMean - dt / 2

    render(
      <UfhLoopDetails
        {...COMMON_PROPS}
        room={ROOM}
        loop={loop}
        tSupplyEff={tSupEff}
        tReturnEff={tRetEff}
      />
    )
    expect(screen.getByText(/Комфорт-режим: подобрано/i)).toBeInTheDocument()
    expect(screen.getByText(/фактическая t_пола/i)).toBeInTheDocument()
    expect(screen.getByText(/вместо целевой/i)).toBeInTheDocument()
  })

  it('показывает "для t_пола" когда фактическая t_пола совпадает с целью (±0.1°C)', () => {
    const sysId = setupSystem()
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 30 })

    render(
      <UfhLoopDetails
        {...COMMON_PROPS}
        floorTempC={30.05}  // within 0.1°C of target=30 → "для t_пола" branch
        room={ROOM}
        loop={loop}
        tSupplyEff={40}
        tReturnEff={30}
      />
    )
    expect(screen.getByText(/Комфорт-режим: подобрано/i)).toBeInTheDocument()
    expect(screen.getByText(/для t_пола/i)).toBeInTheDocument()
  })
})

describe('UfhLoopDetails — comfort mode невозможный (target <= tRoom)', () => {
  it('показывает warn когда tSupplyEff не передан (невозможная цель)', () => {
    const sysId = setupSystem()
    // targetFloorTempC=22 <= tRoom=25 → calculateRequiredCoolantMeanTemp вернёт null
    // → в UfhLoopRow tSupplyEff не будет передан → comfortTempsAdjusted = false
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 22 })

    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={loop} />)
    // tSupplyEff not passed → isComfort=true, comfortTempsAdjusted=false → warn shown
    expect(screen.getByText(/невозможно/i)).toBeInTheDocument()
  })
})

describe('UfhLoopDetails — Phase 3: mode switcher', () => {
  beforeEach(() => {
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('Отопительный radio checked при mode=heating', () => {
    const sysId = setupSystem()
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={makeLoop(sysId)} />)
    expect(screen.getByLabelText('Отопительный режим')).toBeChecked()
    expect(screen.getByLabelText('Комфортный режим')).not.toBeChecked()
  })

  it('Комфортный radio checked при mode=comfort', () => {
    const sysId = setupSystem()
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 30 })
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={loop} />)
    expect(screen.getByLabelText('Комфортный режим')).toBeChecked()
    expect(screen.getByLabelText('Отопительный режим')).not.toBeChecked()
  })

  it('поле targetFloorTempC скрыто при mode=heating', () => {
    const sysId = setupSystem()
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={makeLoop(sysId)} />)
    expect(screen.queryByLabelText('Целевая температура пола')).not.toBeInTheDocument()
  })

  it('поле targetFloorTempC отображается при mode=comfort', () => {
    const sysId = setupSystem()
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 30 })
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={loop} />)
    expect(screen.getByLabelText('Целевая температура пола')).toBeInTheDocument()
  })

  it('переключение на comfort → mode="comfort", targetFloorTempC=30 в store', () => {
    const sysId = setupSystem()
    const loopId = useUfhLoopStore.getState().addLoop({
      roomId: ROOM.id, systemId: sysId, enabled: true, activeAreaM2: 32,
      covering: 'tile', pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3, mode: 'heating',
    })
    const loop = useUfhLoopStore.getState().loops[loopId]
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={loop} />)

    fireEvent.click(screen.getByLabelText('Комфортный режим'))

    expect(useUfhLoopStore.getState().loops[loopId].mode).toBe('comfort')
    expect(useUfhLoopStore.getState().loops[loopId].targetFloorTempC).toBe(30)
  })

  it('переключение на heating → mode="heating", targetFloorTempC=null в store', () => {
    const sysId = setupSystem()
    const loopId = useUfhLoopStore.getState().addLoop({
      roomId: ROOM.id, systemId: sysId, enabled: true, activeAreaM2: 32,
      covering: 'tile', pipeId: 'pe-x-16-2', stepCm: 20, leadInM: 3,
      mode: 'comfort', targetFloorTempC: 30,
    })
    const loop = useUfhLoopStore.getState().loops[loopId]
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={loop} />)

    fireEvent.click(screen.getByLabelText('Отопительный режим'))

    expect(useUfhLoopStore.getState().loops[loopId].mode).toBe('heating')
    expect(useUfhLoopStore.getState().loops[loopId].targetFloorTempC).toBeNull()
  })

  it('предупреждение "цель недостижима" при targetFloorTempC ≤ tRoom', () => {
    const sysId = setupSystem()
    // ROOM.tInside=25, targetFloorTempC=22 → targetTooLow=true
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 22 })
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={loop} />)
    expect(screen.getByText(/цель недостижима/i)).toBeInTheDocument()
  })

  it('подсказка "Контур не учитывается" показывается при mode=comfort', () => {
    const sysId = setupSystem()
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 30 })
    render(<UfhLoopDetails {...COMMON_PROPS} room={ROOM} loop={loop} />)
    expect(screen.getByText(/Контур не учитывается/i)).toBeInTheDocument()
  })
})
