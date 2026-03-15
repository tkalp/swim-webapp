import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

const mockFetchSquadsForCoach = vi.fn().mockResolvedValue([])
const mockCreateSquad = vi.fn()
const mockUpdateSquad = vi.fn()
const mockDeleteSquad = vi.fn()

vi.mock('@/hooks/api', () => ({
  useSquadApi: () => ({
    fetchSquadsForCoach: mockFetchSquadsForCoach,
    createSquad: mockCreateSquad,
    updateSquad: mockUpdateSquad,
    deleteSquad: mockDeleteSquad,
  }),
}))

vi.mock('@/hooks/useStores', () => ({
  useCurrentUser: () => ({ id: 'coach-1' }),
  useAllSquads: () => [],
  useModal: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), data: null }),
}))

vi.mock('@/stores/squadStore', () => ({
  useSquadStore: Object.assign(
    vi.fn((selector: any) => {
      const state = { loading: false, error: null, clearError: vi.fn() }
      return selector ? selector(state) : state
    }),
    { getState: () => ({ setLoading: vi.fn(), setError: vi.fn(), clearError: vi.fn() }) }
  ),
}))

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(() => ({})),
}))

vi.mock('@/components/squads/SquadModal', () => ({
  default: () => null,
}))

vi.mock('@/components/squads/SquadFormModal', () => ({
  default: () => null,
}))

import SquadsPage from '../Squads'

describe('SquadsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page heading', () => {
    render(
      <MemoryRouter>
        <SquadsPage />
      </MemoryRouter>
    )
    expect(screen.getByText('My Squads')).toBeInTheDocument()
  })

  it('renders empty state when no squads loaded', () => {
    render(
      <MemoryRouter>
        <SquadsPage />
      </MemoryRouter>
    )
    expect(screen.getByText('No Squads Yet')).toBeInTheDocument()
  })

  it('renders create squad button in empty state', () => {
    render(
      <MemoryRouter>
        <SquadsPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Create Your First Squad')).toBeInTheDocument()
  })
})
