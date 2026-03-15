import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/squad/CoachConnections', () => ({
  CoachConnections: () => <div data-testid="coach-connections" />,
}))

import CoachNetworkPage from '../CoachNetwork'

describe('CoachNetworkPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Coach Network heading', () => {
    render(
      <MemoryRouter>
        <CoachNetworkPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Coach Network')).toBeInTheDocument()
  })

  it('renders CoachConnections component', () => {
    render(
      <MemoryRouter>
        <CoachNetworkPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('coach-connections')).toBeInTheDocument()
  })

  it('renders description text', () => {
    render(
      <MemoryRouter>
        <CoachNetworkPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/connect with other coaches/i)).toBeInTheDocument()
  })
})
