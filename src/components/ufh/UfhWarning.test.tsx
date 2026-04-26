/**
 * Tests for UfhWarnings component.
 * Covers: no warnings, amber Q<Q_пом, red t_пол>29, red t_пол>33 bathroom, double.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UfhWarnings } from './UfhWarning'

describe('UfhWarnings', () => {
  it('Test 12 (UfhWarning no warning): t_пол below norm, Q_тп >= Q_пом → нет warning', () => {
    const { container } = render(
      <UfhWarnings
        qTpWatts={1200}
        qRoomWatts={1000}
        floorTempC={25}
        floorTempThresholdC={29}
        isBathroom={false}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('Test 9 (UfhWarning Q<Q_пом amber): Q_тп < Q_пом → amber block', () => {
    render(
      <UfhWarnings
        qTpWatts={500}
        qRoomWatts={1000}
        floorTempC={25}
        floorTempThresholdC={29}
        isBathroom={false}
      />
    )
    expect(screen.getByText(/покрывает/)).toBeInTheDocument()
    expect(screen.getByText(/Q_тп = 500 Вт/)).toBeInTheDocument()
    expect(screen.getByText(/Q_пом = 1000 Вт/)).toBeInTheDocument()
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })

  it('Test 10 (UfhWarning t_пол red 29): t_пол > 29 жилая → red block с СП 60', () => {
    render(
      <UfhWarnings
        qTpWatts={1000}
        qRoomWatts={800}
        floorTempC={32}
        floorTempThresholdC={29}
        isBathroom={false}
      />
    )
    expect(screen.getByText(/превышает норму 29°C/)).toBeInTheDocument()
    expect(screen.getByText(/жилые помещения, СП 60/)).toBeInTheDocument()
  })

  it('Test 11 (UfhWarning t_пол red 33 bathroom): t_пол > 33 ванная → red block', () => {
    render(
      <UfhWarnings
        qTpWatts={800}
        qRoomWatts={600}
        floorTempC={35}
        floorTempThresholdC={33}
        isBathroom={true}
      />
    )
    expect(screen.getByText(/превышает норму 33°C/)).toBeInTheDocument()
    expect(screen.getByText(/ванные\/влажные помещения, СП 60/)).toBeInTheDocument()
  })

  it('Test 13 (UfhWarning double): Q<Q_пом И t_пол>норма → оба блока', () => {
    render(
      <UfhWarnings
        qTpWatts={400}
        qRoomWatts={1000}
        floorTempC={32}
        floorTempThresholdC={29}
        isBathroom={false}
      />
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    // amber (Q) first
    expect(alerts[0]).toHaveTextContent('покрывает')
    // red (temp) second
    expect(alerts[1]).toHaveTextContent('превышает норму')
  })

  it('Test 13b: coverage percentage calculation', () => {
    render(
      <UfhWarnings
        qTpWatts={700}
        qRoomWatts={1000}
        floorTempC={25}
        floorTempThresholdC={29}
        isBathroom={false}
      />
    )
    expect(screen.getByText(/70%/)).toBeInTheDocument()
  })

  it('only Q warning shown when temp OK', () => {
    render(
      <UfhWarnings
        qTpWatts={500}
        qRoomWatts={1000}
        floorTempC={25}
        floorTempThresholdC={29}
        isBathroom={false}
      />
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toHaveTextContent('покрывает')
  })

  it('only temp warning shown when Q ok', () => {
    render(
      <UfhWarnings
        qTpWatts={1200}
        qRoomWatts={1000}
        floorTempC={32}
        floorTempThresholdC={29}
        isBathroom={false}
      />
    )
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toHaveTextContent('превышает норму')
  })
})
