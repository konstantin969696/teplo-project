/**
 * RED scaffold: SystemAccordion UI tests.
 * Tests WILL FAIL until SystemAccordion is implemented in Plan 05.
 *
 * Covers:
 *   - header: system name, summary metadata, aria-expanded default false
 *   - expand/collapse: click, keyboard, chevron rotation
 *   - delete icon: presence, opens ConfirmDialog, stops accordion toggle
 *   - expanded content: SystemCard, SegmentTable, PumpRecommendation, BalancingBlock
 *   - variant="ufh": renders UfhTable instead
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { act } from 'react'
import { SystemAccordion } from './SystemAccordion'
import { useSystemStore } from '../../store/systemStore'
import { useSegmentStore } from '../../store/segmentStore'
import type { HeatingSystem } from '../../types/system'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}))

beforeEach(() => {
  act(() => {
    useSystemStore.setState({ systems: {}, systemOrder: [] })
    useSegmentStore.setState({ segments: {}, segmentOrder: [] })
  })
})

function setupSystem(overrides: Partial<Omit<HeatingSystem, 'id'>> = {}): string {
  let systemId = ''
  act(() => {
    systemId = useSystemStore.getState().addSystem({
      name: 'Система 1',
      schemaType: 'two-pipe-dead-end',
      pipeMaterialId: 'steel-vgp-dn20',
      coolantId: 'water',
      tSupply: 80,
      tReturn: 60,
      tSupplyUfh: 45,
      tReturnUfh: 35,
      sourceLabel: '',
      ...overrides
    })
  })
  return systemId
}

describe('SystemAccordion header', () => {
  it('renders system name as button', () => {
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    expect(screen.getByRole('button', { name: 'Система 1' })).toBeInTheDocument()
  })

  it('renders summary metadata in header', () => {
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    // Summary should contain schema type label
    expect(screen.getByText(/2-труб тупиков/i)).toBeInTheDocument()
    // Pipe material label
    expect(screen.getByText(/сталь/i)).toBeInTheDocument()
    // Coolant label
    expect(screen.getByText(/вода/i)).toBeInTheDocument()
  })

  it('summary metadata separated by "·" character', () => {
    const systemId = setupSystem()
    const { container } = render(<SystemAccordion systemId={systemId} />)
    const header = container.querySelector('[data-testid="system-header"], header, [role="button"]')
    expect(header?.textContent ?? container.textContent).toMatch(/·/)
  })

  it('has aria-expanded="false" by default (collapsed)', () => {
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SystemAccordion expand/collapse', () => {
  it('click header toggles aria-expanded to true', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('second click collapses back to aria-expanded="false"', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    await user.click(button)
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('Enter key toggles accordion', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('Space key toggles accordion', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    button.focus()
    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('chevron has rotate-90 class when expanded', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    const { container } = render(<SystemAccordion systemId={systemId} />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    await user.click(button)
    // Chevron icon should have rotate class when expanded
    const chevron = container.querySelector('[data-testid="chevron"], .chevron, svg')
    expect(chevron?.className ?? '').toMatch(/rotate/)
  })
})

describe('SystemAccordion delete icon', () => {
  it('renders trash icon with aria-label containing system name', () => {
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const deleteBtn = screen.getByRole('button', { name: /Удалить систему Система 1/i })
    expect(deleteBtn).toBeInTheDocument()
  })

  it('clicking delete opens ConfirmDialog without toggling accordion', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const deleteBtn = screen.getByRole('button', { name: /Удалить систему Система 1/i })
    const headerBtn = screen.getByRole('button', { name: 'Система 1' })
    await user.click(deleteBtn)
    // ConfirmDialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Accordion should still be collapsed (stopPropagation worked)
    expect(headerBtn).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SystemAccordion expanded content', () => {
  it('renders SystemCard, SegmentTable, PumpRecommendation, BalancingBlock when expanded', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    await user.click(button)
    // Expanded sections should be visible
    expect(screen.getByTestId('system-card')).toBeInTheDocument()
    expect(screen.getByTestId('segment-table')).toBeInTheDocument()
    expect(screen.getByTestId('pump-recommendation')).toBeInTheDocument()
    expect(screen.getByTestId('balancing-block')).toBeInTheDocument()
  })

  it('variant="ufh" renders UfhTable instead of SegmentTable/Pump/Balancing', async () => {
    const user = userEvent.setup()
    const systemId = setupSystem()
    render(<SystemAccordion systemId={systemId} variant="ufh" />)
    const button = screen.getByRole('button', { name: 'Система 1' })
    await user.click(button)
    expect(screen.getByTestId('ufh-table')).toBeInTheDocument()
    expect(screen.queryByTestId('segment-table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pump-recommendation')).not.toBeInTheDocument()
    expect(screen.queryByTestId('balancing-block')).not.toBeInTheDocument()
  })
})
