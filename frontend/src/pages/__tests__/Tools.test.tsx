import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Tools from '../Tools'

describe('Tools', () => {
  it('renders Coaching Tools heading', () => {
    render(
      <MemoryRouter>
        <Tools />
      </MemoryRouter>
    )
    expect(screen.getByText('Coaching Tools')).toBeInTheDocument()
  })

  it('renders Swimmer Comparison tool card', () => {
    render(
      <MemoryRouter>
        <Tools />
      </MemoryRouter>
    )
    expect(screen.getByText('Swimmer Comparison')).toBeInTheDocument()
  })

  it('renders AI Coach Assistant tool card', () => {
    render(
      <MemoryRouter>
        <Tools />
      </MemoryRouter>
    )
    expect(screen.getByText('AI Coach Assistant')).toBeInTheDocument()
  })

  it('renders Time Standards tool card', () => {
    render(
      <MemoryRouter>
        <Tools />
      </MemoryRouter>
    )
    expect(screen.getByText('Time Standards')).toBeInTheDocument()
  })

  it('links to /tools/comparison', () => {
    render(
      <MemoryRouter>
        <Tools />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /swimmer comparison/i })
    expect(link).toHaveAttribute('href', '/tools/comparison')
  })
})
