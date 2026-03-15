import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ squadId: 'test-squad-id' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'coach@test.com', user_metadata: {} }, coachProfile: null, loading: false }),
}))

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))

vi.mock('@/stores/permissionStore', () => ({
  usePermissionStore: vi.fn(() => ({
    loadPermissions: vi.fn(),
    getPermissions: vi.fn(() => null),
    hasPermission: vi.fn(() => true),
    isOwner: vi.fn(() => false),
    isAdmin: vi.fn(() => false),
  })),
}))

vi.mock('@/hooks/useStores', () => ({
  useSquadDetails: () => ({ id: 'test-squad-id', name: 'Test Squad' }),
  useSwimmersBySquad: () => [],
  useSquadSchedules: () => [],
  useSquadSessions: () => [],
  useSquadEvents: () => [],
}))

vi.mock('@/hooks/api', () => ({
  useSwimmerApi: () => ({
    createSwimmer: vi.fn(),
    updateSwimmer: vi.fn(),
    deleteSwimmer: vi.fn(),
  }),
}))

const mockSetSquadDetails = vi.fn()
const mockSetSchedules = vi.fn()
const mockSetSessions = vi.fn()
const mockSetEvents = vi.fn()
const mockSetSwimmers = vi.fn()

vi.mock('@/stores/squadStore', () => ({
  useSquadStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: () => ({
        setSquadDetails: mockSetSquadDetails,
        setSchedules: mockSetSchedules,
        setSessions: mockSetSessions,
        setEvents: mockSetEvents,
      }),
    }
  ),
}))

vi.mock('@/stores/swimmerStore', () => ({
  useSwimmerStore: Object.assign(
    vi.fn(() => ({})),
    { getState: () => ({ setSwimmers: mockSetSwimmers }) }
  ),
}))

vi.mock('@/services/squadService', () => ({
  getSquadById: vi.fn().mockResolvedValue({ id: 'test-squad-id', name: 'Test Squad' }),
  getSquadSwimmers: vi.fn().mockResolvedValue([]),
  getSquadSchedules: vi.fn().mockResolvedValue([]),
  getSquadSessions: vi.fn().mockResolvedValue([]),
  getSquadCalendarEvents: vi.fn().mockResolvedValue([]),
  triggerSquadSync: vi.fn(),
  getSquadSyncStatus: vi.fn(),
}))

vi.mock('@/components/ui/Loaders', () => ({
  Shimmer: () => <div data-testid="shimmer" />,
  ErrorToast: ({ msg }: any) => <div data-testid="error-toast">{msg}</div>,
}))

vi.mock('@/components/ui/Breadcrumb', () => ({
  Breadcrumb: ({ items }: any) => (
    <nav>{items.map((item: any, i: number) => <span key={i}>{item.label}</span>)}</nav>
  ),
}))

vi.mock('@/components/squad/SwimmersGrid', () => ({
  default: () => <div data-testid="swimmers-grid" />,
}))

vi.mock('@/components/squad/SquadSidebar', () => ({
  SquadSidebar: ({ activeTab, onTabChange }: any) => (
    <nav data-testid="squad-sidebar">
      <button onClick={() => onTabChange('team')}>Team</button>
    </nav>
  ),
  SquadMobileNav: () => <div data-testid="squad-mobile-nav" />,
}))

vi.mock('@/components/squad/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab" />,
}))

vi.mock('@/components/squad/TrainingTab', () => ({
  TrainingTab: () => <div data-testid="training-tab" />,
}))

vi.mock('@/components/squad/SquadCoachesTab', () => ({
  SquadCoachesTab: () => <div data-testid="coaches-tab" />,
}))

vi.mock('@/components/squad/CalendarTab', () => ({
  CalendarTab: () => <div data-testid="calendar-tab" />,
}))

import SquadPage from '../Squad'

describe('SquadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders squad page with breadcrumb after loading', async () => {
    render(
      <MemoryRouter>
        <SquadPage />
      </MemoryRouter>
    )
    // Loading state shows first, then content
    const shimmer = screen.queryByTestId('shimmer')
    // The shimmer is shown while loading=true
    expect(shimmer).toBeInTheDocument()
  })

  it('shows overview tab label in breadcrumb when loaded', async () => {
    const { findByText } = render(
      <MemoryRouter>
        <SquadPage />
      </MemoryRouter>
    )
    // After loading completes, we should see breadcrumb with Overview
    const overviewLabel = await findByText('Overview')
    expect(overviewLabel).toBeInTheDocument()
  })
})
