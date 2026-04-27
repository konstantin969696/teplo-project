/**
 * Tests for UfhLoopDetails comfort-mode rendering.
 * Covers: heating-default (no banner), comfort with valid target (banner + temps),
 * comfort-impossible fallback (warn banner).
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UfhLoopDetails } from './UfhLoopDetails'
import { useSystemStore } from '../../store/systemStore'
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
  it('показывает comfort banner с подобранными температурами', () => {
    const sysId = setupSystem()
    const loop = makeLoop(sysId, { mode: 'comfort', targetFloorTempC: 30 })

    // Compute effective temps the same way UfhLoopRow would
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
