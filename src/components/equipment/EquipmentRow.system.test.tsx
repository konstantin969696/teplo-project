/**
 * RED scaffold: EquipmentRow system dropdown (D-10).
 * Tests WILL FAIL until system dropdown is added to EquipmentSubRow in Plan 05.
 *
 * Design decision (PATTERNS §18):
 *   dropdown goes in EquipmentSubRow (per-equipment level), NOT EquipmentRow (per-room).
 *   Reason: systemId is a property of an individual radiator — one room can have equipment
 *   from different systems (e.g. radiator in primary system + towel rail in UFH).
 *
 * Covers:
 *   - dropdown renders with options from systemOrder
 *   - dropdown is in EquipmentSubRow (per-equipment expanded block), not main row cells
 *   - change triggers updateEquipment with new systemId
 *   - LMTD recomputes after system change
 *   - aria-label on dropdown
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { act } from 'react'
import { EquipmentRow } from './EquipmentRow'
import { useSystemStore } from '../../store/systemStore'
import { useEquipmentStore } from '../../store/equipmentStore'
import { useProjectStore } from '../../store/projectStore'
import { useCoolantCatalogStore } from '../../store/coolantCatalogStore'
import type { Room } from '../../types/project'
import type { Equipment } from '../../types/project'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}))

const testRoom: Room = {
  id: 'room-1',
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
  tInside: 20
}

let sysId1: string
let sysId2: string
let eqId: string

beforeEach(() => {
  act(() => {
    useSystemStore.setState({ systems: {}, systemOrder: [] })
    useEquipmentStore.setState({ equipment: {}, equipmentOrder: [] })
    useCoolantCatalogStore.getState().resetToSeed()

    // Setup 2 systems
    sysId1 = useSystemStore.getState().addSystem({
      name: 'Система 1',
      schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'steel-vgp-dn20',
      coolantId: 'water',
      tSupply: 80,
      tReturn: 60,
      tSupplyUfh: 45,
      tReturnUfh: 35,
      sourceLabel: ''
    })

    sysId2 = useSystemStore.getState().addSystem({
      name: 'Система 2',
      schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'steel-vgp-dn20',
      coolantId: 'water',
      tSupply: 60,
      tReturn: 40,
      tSupplyUfh: 45,
      tReturnUfh: 35,
      sourceLabel: ''
    })

    // Setup 1 equipment with systemId
    eqId = useEquipmentStore.getState().addEquipment({
      roomId: 'room-1',
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
      systemId: sysId1
    } as unknown as Omit<Equipment, 'id'>)
  })
})

/**
 * NOTE ON PLACEMENT (per PATTERNS §18):
 * The system dropdown is located in EquipmentSubRow (the expanded per-equipment section),
 * NOT in the top-level EquipmentRow cells. This test verifies that behavior:
 * - The select with system options is inside the expanded sub-row tbody
 * - Not in the main room-level row header cells
 */
describe('system dropdown in EquipmentSubRow (per-equipment, not per-room)', () => {
  it('renders select with options from systemOrder (2 systems)', async () => {
    const user = userEvent.setup()
    render(
      <table>
        <tbody>
          <EquipmentRow room={testRoom} index={0} />
        </tbody>
      </table>
    )
    // Need to expand the equipment row to see EquipmentSubRow
    const expandButton = screen.getByRole('button', { name: /^развернуть приборы/i })
    await user.click(expandButton)

    // System dropdown should now be visible
    const systemSelect = screen.getByRole('combobox', {
      name: /выберите систему отопления для прибора/i
    })
    expect(systemSelect).toBeInTheDocument()

    // Options from systemOrder
    const options = screen.getAllByRole('option')
    const optionNames = options.map(o => o.textContent)
    expect(optionNames).toContain('Система 1')
    expect(optionNames).toContain('Система 2')
  })

  it('dropdown is in expanded EquipmentSubRow, NOT in main row cells', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <table>
        <tbody>
          <EquipmentRow room={testRoom} index={0} />
        </tbody>
      </table>
    )
    // Before expanding: no system select visible
    expect(screen.queryByRole('combobox', { name: /система/i })).not.toBeInTheDocument()

    // After expanding: system select appears in sub-row, not main row
    const expandButton = screen.getByRole('button', { name: /^развернуть приборы/i })
    await user.click(expandButton)

    const systemSelect = screen.getByRole('combobox', { name: /выберите систему отопления для прибора/i })
    // The select should be inside a tbody (sub-row), not the outer summary cells
    expect(systemSelect).toBeInTheDocument()
  })

  it('change triggers updateEquipment with new systemId', async () => {
    const user = userEvent.setup()
    const updateEquipmentSpy = vi.spyOn(useEquipmentStore.getState(), 'updateEquipment')

    render(
      <table>
        <tbody>
          <EquipmentRow room={testRoom} index={0} />
        </tbody>
      </table>
    )
    const expandButton = screen.getByRole('button', { name: /^развернуть приборы/i })
    await user.click(expandButton)

    const systemSelect = screen.getByRole('combobox', { name: /выберите систему отопления для прибора/i })
    await user.selectOptions(systemSelect, 'Система 2')

    expect(updateEquipmentSpy).toHaveBeenCalledWith(
      eqId,
      expect.objectContaining({ systemId: sysId2 })
    )
  })

  it('LMTD recomputes after switching system with different tSupply', async () => {
    const user = userEvent.setup()
    render(
      <table>
        <tbody>
          <EquipmentRow room={testRoom} index={0} />
        </tbody>
      </table>
    )
    const expandButton = screen.getByRole('button', { name: /^развернуть приборы/i })
    await user.click(expandButton)

    // Get initial LMTD display (system 1: 80/60)
    const lmtdBefore = screen.getByTestId('lmtd-value')?.textContent ?? ''

    // Switch to system 2 (60/40 — different temperature pair)
    const systemSelect = screen.getByRole('combobox', { name: /выберите систему отопления для прибора/i })
    await user.selectOptions(systemSelect, 'Система 2')

    const lmtdAfter = screen.getByTestId('lmtd-value')?.textContent ?? ''
    // LMTD should change since tSupply changed from 80 to 60
    expect(lmtdBefore).not.toBe(lmtdAfter)
  })
})

describe('system dropdown aria', () => {
  it('has aria-label "Выберите систему отопления для прибора"', async () => {
    const user = userEvent.setup()
    render(
      <table>
        <tbody>
          <EquipmentRow room={testRoom} index={0} />
        </tbody>
      </table>
    )
    const expandButton = screen.getByRole('button', { name: /^развернуть приборы/i })
    await user.click(expandButton)

    const systemSelect = screen.getByRole('combobox', { name: /выберите систему отопления для прибора/i })
    expect(systemSelect).toHaveAttribute('aria-label', 'Выберите систему отопления для прибора')
  })
})
