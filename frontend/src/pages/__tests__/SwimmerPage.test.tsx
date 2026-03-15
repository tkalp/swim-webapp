import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ swimmerId: 'swimmer-1' }),
}))

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'coach@test.com', user_metadata: {} },
    coachProfile: null,
    loading: false,
  }),
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

vi.mock('@/hooks/useSwimmerStats', () => ({
  useSwimmerStats: () => ({
    loading: false,
    err: '',
    attendance: null,
    sessions: [],
    totalAttendance: 0,
    presentPct: 0,
    attendanceData: [],
    avgPerWeek: 0,
    bestWeek: 0,
    swimmer: {
      id: 'swimmer-1',
      first_name: 'Jane',
      last_name: 'Doe',
      sex: 'Female',
      date_of_birth: '2005-01-01',
      squad_id: 'squad-1',
      external_links: [],
    },
  }),
}))

vi.mock('@/services/swimmerService', () => ({
  getSwimmerSyncStatus: vi.fn().mockResolvedValue({ sync_status: 'idle' }),
  cancelSwimmerSync: vi.fn(),
}))

vi.mock('@/components/ui/PageHeader', () => ({
  default: ({ title, tabs, activeTab, onTabChange }: any) => (
    <div data-testid="page-header">
      <div data-testid="page-title">{typeof title === 'string' ? title : 'Swimmer Stats'}</div>
      {tabs?.map((tab: any) => (
        <button key={tab.key} onClick={() => onTabChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@/components/swimmers/BestTimesTab', () => ({
  default: () => <div data-testid="best-times-tab" />,
}))

vi.mock('@/components/swimmers/FinaPointsTab', () => ({
  default: () => <div data-testid="fina-points-tab" />,
}))

vi.mock('@/components/swimmers/SwimRankingsLink', () => ({
  default: () => <div data-testid="swim-rankings-link" />,
}))

vi.mock('@/components/charts/AttendanceChart', () => ({
  default: () => <div data-testid="attendance-chart" />,
}))

vi.mock('@/components/charts/SessionsPerWeekChart', () => ({
  default: () => <div data-testid="sessions-chart" />,
}))

vi.mock('@/components/stats/SwimmerOverviewStats', () => ({
  default: () => <div data-testid="overview-stats" />,
}))

vi.mock('@/components/range/RangeToolbar', () => ({
  default: () => <div data-testid="range-toolbar" />,
}))

import SwimmerPage from '../SwimmerPage'

function renderSwimmerPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SwimmerPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SwimmerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    renderSwimmerPage()
    expect(screen.getByTestId('page-header')).toBeInTheDocument()
  })

  it('renders best times tab when totalAttendance is 0', () => {
    renderSwimmerPage()
    expect(screen.getByTestId('best-times-tab')).toBeInTheDocument()
  })

  it('shows FINA Points tab option', () => {
    renderSwimmerPage()
    expect(screen.getByRole('button', { name: /fina points/i })).toBeInTheDocument()
  })
})
