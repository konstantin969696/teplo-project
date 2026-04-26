/**
 * Tests for KmsPicker modal.
 * Covers: open renders list, increment/decrement, live ΣКМС, apply updates store, Escape closes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { KmsPicker } from './KmsPicker'
import { useSegmentStore } from '../../store/segmentStore'
import { useKmsCatalogStore } from '../../store/kmsCatalogStore'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

let segmentId = ''

beforeEach(() => {
  act(() => {
    useKmsCatalogStore.getState().resetToSeed()
    useSegmentStore.setState({ segments: {}, segmentOrder: [] })
    segmentId = useSegmentStore.getState().addSegment({
      parentSegmentId: null,
      name: 'Тест',
      equipmentId: null,
      qOverride: null,
      lengthM: 5,
      pipeId: 'steel-vgp-dn20',
      dnMm: null,
      kmsCounts: {},
      velocityTargetMS: 0.6,
    })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('KmsPicker', () => {
  it('renders null when open=false', () => {
    const { container } = render(
      <KmsPicker segmentId={segmentId} open={false} onClose={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders dialog with КМС list when open=true', () => {
    render(<KmsPicker segmentId={segmentId} open={true} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: /Местные сопротивления участка/i })).toBeInTheDocument()
    expect(screen.getByText(/ΣКМС =/i)).toBeInTheDocument()
  })

  it('shows КМС items from catalog (plus/minus buttons visible)', () => {
    render(<KmsPicker segmentId={segmentId} open={true} onClose={() => {}} />)
    // Each KMS item has + and - buttons
    const plusBtns = screen.getAllByLabelText(/Прибавить/)
    const minusBtns = screen.getAllByLabelText(/Убавить/)
    const kmsCount = Object.keys(useKmsCatalogStore.getState().elements).length
    expect(plusBtns.length).toBe(kmsCount)
    expect(minusBtns.length).toBe(kmsCount)
  })

  it('increment button increases count and updates ΣКМС', () => {
    render(<KmsPicker segmentId={segmentId} open={true} onClose={() => {}} />)
    const kmsItems = Object.values(useKmsCatalogStore.getState().elements)
    const first = kmsItems[0]
    if (!first) return

    // Find + button for the first KMS item
    const plusBtns = screen.getAllByLabelText(new RegExp(`Прибавить`))
    fireEvent.click(plusBtns[0])

    // ΣКМС should now be first.zeta
    const sumLabel = screen.getByText(/ΣКМС =/)
    expect(sumLabel.textContent).toContain(first.zeta.toFixed(2))
  })

  it('decrement button decreases count (not below 0)', () => {
    render(<KmsPicker segmentId={segmentId} open={true} onClose={() => {}} />)
    const minusBtns = screen.getAllByLabelText(/Убавить/)
    // count starts at 0, click minus → should remain 0
    fireEvent.click(minusBtns[0])
    // ΣКМС should still be 0.00
    expect(screen.getByText(/ΣКМС = 0.00/)).toBeInTheDocument()
  })

  it('Apply button calls updateSegment with current counts', () => {
    render(<KmsPicker segmentId={segmentId} open={true} onClose={vi.fn()} />)
    const kmsItems = Object.values(useKmsCatalogStore.getState().elements)
    const first = kmsItems[0]
    if (!first) return

    const plusBtns = screen.getAllByLabelText(/Прибавить/)
    fireEvent.click(plusBtns[0])
    fireEvent.click(plusBtns[0])  // count = 2

    const applyBtn = screen.getByRole('button', { name: /Применить/i })
    fireEvent.click(applyBtn)

    const seg = useSegmentStore.getState().segments[segmentId]
    expect(seg?.kmsCounts[first.id]).toBe(2)
  })

  it('Escape key closes the picker', () => {
    const onClose = vi.fn()
    render(<KmsPicker segmentId={segmentId} open={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('overlay click closes the picker', () => {
    const onClose = vi.fn()
    render(<KmsPicker segmentId={segmentId} open={true} onClose={onClose} />)
    const overlay = screen.getByRole('dialog', { name: /Местные сопротивления участка/i })
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })
})
