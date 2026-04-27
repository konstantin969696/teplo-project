/**
 * Tests for UfhLoopRow component.
 * Covers: compact rendering, enable toggle, F_тп default, pipe filter,
 * q calculation, expand/collapse, warn-icon.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { UfhLoopRow } from './UfhLoopRow'
import { useProjectStore } from '../../store/projectStore'
import { useUfhLoopStore } from '../../store/ufhLoopStore'
import { usePipeCatalogStore } from '../../store/pipeCatalogStore'
import type { Room } from '../../types/project'

const ROOM: Room = {
  id: 'test-room',
  name: 'Гостиная',
  floor: 1,
  area: 20,
  height: 2.7,
  tInside: 20,
  isCorner: false,
  infiltrationMethod: 'rate',
  nInfiltration: null,
  gapArea: null,
  windSpeed: null,
  lVentilation: 0,
}

const BATHROOM_ROOM: Room = {
  ...ROOM,
  id: 'test-bathroom',
  name: 'Ванная',
  area: 6,
}

function renderRow(room: Room = ROOM, index = 0) {
  return render(
    <table>
      <tbody>
        <UfhLoopRow room={room} index={index} />
      </tbody>
    </table>
  )
}

describe('UfhLoopRow', () => {
  beforeEach(() => {
    useProjectStore.setState({ tSupplyUfh: 45, tReturnUfh: 35, city: null })
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
  })

  it('Test 1 (UfhLoopRow compact): отрисовывает room.name', () => {
    renderRow()
    expect(screen.getByText('Гостиная')).toBeInTheDocument()
  })

  it('Test 1b (UfhLoopRow compact): F_тп input присутствует', () => {
    renderRow()
    expect(screen.getByLabelText('F_тп, м²')).toBeInTheDocument()
  })

  it('Test 1c (UfhLoopRow compact): Покрытие select присутствует', () => {
    renderRow()
    expect(screen.getByLabelText('Покрытие')).toBeInTheDocument()
  })

  it('Test 1d (UfhLoopRow compact): Труба select присутствует', () => {
    renderRow()
    expect(screen.getByLabelText('Труба ТП')).toBeInTheDocument()
  })

  it('Test 1e (UfhLoopRow compact): Шаг input присутствует', () => {
    renderRow()
    expect(screen.getByLabelText('Шаг укладки, см')).toBeInTheDocument()
  })

  it('Test 2 (UfhLoopRow enable toggle): checkbox присутствует', () => {
    renderRow()
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
  })

  it('Test 3 (UfhLoopRow F_тп default): F_тп = 0.8·area = 16.0 для area=20', () => {
    renderRow()
    const areaInput = screen.getByLabelText('F_тп, м²') as HTMLInputElement
    // defaultValue = Math.round(20 * 0.8 * 10) / 10 = 16.0
    expect(parseFloat(areaInput.defaultValue)).toBeCloseTo(16.0, 1)
  })

  it('Test 5 (UfhLoopRow pipe filter): select содержит только UFH-трубы (maxLoopLengthM != null)', () => {
    renderRow()
    const pipeSelect = screen.getByLabelText('Труба ТП') as HTMLSelectElement
    const allPipes = Object.values(usePipeCatalogStore.getState().pipes)
    const ufhPipes = allPipes.filter(p => p.maxLoopLengthM !== null)
    const nonUfhPipes = allPipes.filter(p => p.maxLoopLengthM === null)
    expect(pipeSelect.options.length).toBe(ufhPipes.length)
    // Make sure non-UFH pipes are not in the select
    expect(nonUfhPipes.length).toBeGreaterThan(0) // sanity check
    expect(pipeSelect.options.length).toBeLessThan(allPipes.length)
  })

  it('Test 6 (UfhLoopRow q calc): loop enabled с tile → q показывается (не —)', () => {
    // Enable loop so q is computed
    useUfhLoopStore.getState().addLoop({
      roomId: 'test-room',
      enabled: true,
      activeAreaM2: 16,
      covering: 'tile',
      pipeId: 'pe-x-16-2',
      stepCm: 20,
      leadInM: 3,
    })
    renderRow()
    // q = calculateHeatFlux(45, 35, 20, 'tile') ≈ 215
    // Cell shows numeric q value (not "—")
    const cells = screen.getAllByRole('cell')
    const qCell = cells[cells.length - 2] // q column (second to last)
    const qText = qCell.textContent ?? ''
    expect(qText).not.toBe('—')
    const qVal = parseFloat(qText)
    expect(qVal).toBeGreaterThan(230)
    expect(qVal).toBeLessThan(260)
  })

  it('Test 7 (UfhLoopRow expand): click → aria-expanded true', () => {
    renderRow()
    const row = screen.getByRole('row', { expanded: false })
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
  })

  it('Test 14 (warn-icon в compact): disabled loop → нет warn-icon', () => {
    renderRow()
    // Loop disabled by default (no loop in store) → no warning icon
    expect(screen.queryByLabelText('Предупреждение')).not.toBeInTheDocument()
  })

  it('Test 14b (warn-icon): enabled loop with high temp → warn icon показывается', () => {
    // tS=45, tR=35, tRoom=20, covering=tile → q≈215, tFloor≈40 > 29 → warning
    useUfhLoopStore.getState().addLoop({
      roomId: 'test-room',
      enabled: true,
      activeAreaM2: 16,
      covering: 'tile',
      pipeId: 'pe-x-16-2',
      stepCm: 20,
      leadInM: 3,
    })
    renderRow()
    expect(screen.getByLabelText('Предупреждение')).toBeInTheDocument()
  })

  it('Test 3b (UfhLoopRow F_тп default): для area=10 дефолт = 8.0', () => {
    const room10: Room = { ...ROOM, id: 'room-10', area: 10 }
    useUfhLoopStore.setState({ loops: {}, loopsByRoom: {} })
    render(
      <table>
        <tbody>
          <UfhLoopRow room={room10} index={0} />
        </tbody>
      </table>
    )
    const areaInput = screen.getByLabelText('F_тп, м²') as HTMLInputElement
    expect(parseFloat(areaInput.defaultValue)).toBeCloseTo(8.0, 1)
  })

  it('Test 4 (UfhLoopRow F_тп persist): onBlur → addLoop вызван', () => {
    renderRow()
    const areaInput = screen.getByLabelText('F_тп, м²')
    fireEvent.blur(areaInput, { target: { value: '14' } })
    const loops = Object.values(useUfhLoopStore.getState().loops)
    expect(loops.length).toBeGreaterThan(0)
  })

  it('бейджик "Комфортный режим ТП" показывается при mode=comfort', () => {
    useUfhLoopStore.getState().addLoop({
      roomId: 'test-room',
      enabled: true,
      activeAreaM2: 16,
      covering: 'tile',
      pipeId: 'pe-x-16-2',
      stepCm: 20,
      leadInM: 3,
      mode: 'comfort',
      targetFloorTempC: 30,
    })
    renderRow()
    expect(screen.getByLabelText('Комфортный режим ТП')).toBeInTheDocument()
  })

  it('бейджик "Комфортный режим ТП" НЕ показывается при mode=heating', () => {
    useUfhLoopStore.getState().addLoop({
      roomId: 'test-room',
      enabled: true,
      activeAreaM2: 16,
      covering: 'tile',
      pipeId: 'pe-x-16-2',
      stepCm: 20,
      leadInM: 3,
      mode: 'heating',
      targetFloorTempC: null,
    })
    renderRow()
    expect(screen.queryByLabelText('Комфортный режим ТП')).not.toBeInTheDocument()
  })

  it('bathroom room uses 33°C threshold heuristic (isBathroomRoom)', () => {
    useUfhLoopStore.getState().addLoop({
      roomId: 'test-bathroom',
      enabled: true,
      activeAreaM2: 4.8,
      covering: 'tile',
      pipeId: 'pe-x-16-2',
      stepCm: 20,
      leadInM: 3,
    })
    render(
      <table>
        <tbody>
          <UfhLoopRow room={BATHROOM_ROOM} index={0} />
        </tbody>
      </table>
    )
    // tS=45, tR=35, tRoom=20, tile → q≈215, tFloor≈40 > 33 → warning shown
    expect(screen.getByLabelText('Предупреждение')).toBeInTheDocument()
  })
})
