import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyTabState } from './EmptyTabState'

describe('EmptyTabState', () => {
  it('renders heading text', () => {
    render(<EmptyTabState tabName="Гидравлика" />)
    expect(screen.getByText('Раздел в разработке')).toBeDefined()
  })

  it('renders tab name in description', () => {
    render(<EmptyTabState tabName="Гидравлика" />)
    expect(screen.getByText(/Гидравлика/)).toBeDefined()
    expect(screen.getByText(/будет доступен в следующих версиях/)).toBeDefined()
  })

  it('renders with different tab name', () => {
    render(<EmptyTabState tabName="Тёплый пол" />)
    expect(screen.getByText(/Тёплый пол/)).toBeDefined()
  })
})
