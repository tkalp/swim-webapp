import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ slug: 'jane-doe' }),
  useLocation: () => ({
    state: {
      swimmer: {
        athlete_id: 'athlete-123',
        name: 'Jane Doe',
        gender: 'Female',
        nationality: 'USA',
        club: 'Test Club',
      },
    },
  }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

vi.mock('@/services/swimRankingsService', () => ({
  getExternalSwimmerFinaPoints: vi.fn().mockResolvedValue({
    athlete_id: 'athlete-123',
    name: 'Jane Doe',
    best_times: [],
    fina_points: [],
  }),
}))

vi.mock('@/services/swimmerService', () => ({
  createSwimmerWithExternalLink: vi.fn(),
  getSwimmerSyncStatus: vi.fn().mockResolvedValue({ sync_status: 'idle' }),
}))

vi.mock('@/components/swimmers/AddToSquadModal', () => ({
  default: ({ isOpen }: any) => isOpen ? <div data-testid="add-to-squad-modal" /> : null,
}))

import ExternalSwimmerPage from '../ExternalSwimmerPage'

describe('ExternalSwimmerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing when swimmer state provided', () => {
    render(
      <MemoryRouter>
        <ExternalSwimmerPage />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('shows loading state initially', () => {
    render(
      <MemoryRouter>
        <ExternalSwimmerPage />
      </MemoryRouter>
    )
    // While fetching FINA data the page shows a loader
    const loaders = document.querySelectorAll('[class*="animate"]')
    expect(loaders.length).toBeGreaterThan(0)
  })
})
