import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BestTimesTab from '../BestTimesTab'

// Mock workoutResultService
vi.mock('@/services/workoutResultService', () => ({
  getSwimmerBestTimes: vi.fn().mockResolvedValue([
    {
      id: 'result-1',
      distance: 100,
      stroke: 'freestyle',
      activity: 'swim',
      equipment: 'none',
      units: 'meters',
      resultUnits: 'meters',
      timeSeconds: 55.0,
      performedOn: '2024-01-15',
    },
  ]),
  getSwimmerPredictions: vi.fn().mockResolvedValue(null),
}))

// Mock useFeatureFlags (requires AuthContext)
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    hasTimeStandards: false,
    hasQualifiers: false,
  }),
}))

// Mock useSquadBenchmarks (requires react-query)
vi.mock('@/hooks/useSquadBenchmarks', () => ({
  useSquadBenchmarks: () => ({
    data: {},
    isLoading: false,
  }),
}))

// Mock child components to keep tests focused
vi.mock('@/components/swimmers/bestTimes/GroupedBestTimesView', () => ({
  default: ({ bestTimes }: { bestTimes: any[] }) => (
    <div data-testid="grouped-best-times">
      {bestTimes.map((t) => (
        <div key={t.id} data-testid="best-time-row">
          {t.distance}m {t.stroke}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/swimmers/bestTimes/AttemptsModal', () => ({
  default: () => <div data-testid="attempts-modal" />,
}))

vi.mock('@/components/swimmers/bestTimes/AddEditWorkoutResultModal', () => ({
  default: () => <div data-testid="add-edit-modal" />,
}))

vi.mock('@/components/ui/Modal', () => ({
  default: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}))

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('BestTimesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    renderWithQuery(<BestTimesTab swimmerId="swimmer-1" />)
    // Component should render (may show loading initially)
    expect(document.body).toBeTruthy()
  })

  it('shows best times after loading', async () => {
    renderWithQuery(<BestTimesTab swimmerId="swimmer-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('grouped-best-times')).toBeInTheDocument()
    })
  })

  it('renders best time rows from service data', async () => {
    renderWithQuery(<BestTimesTab swimmerId="swimmer-1" />)

    await waitFor(() => {
      expect(screen.getByTestId('best-time-row')).toBeInTheDocument()
    })

    expect(screen.getByText(/100m freestyle/i)).toBeInTheDocument()
  })

  it('does not show squad ranks toggle by default', () => {
    renderWithQuery(<BestTimesTab swimmerId="swimmer-1" />)
    // showSquadRanks starts false, no rank data rendered initially
    expect(screen.queryByText(/squad rank/i)).not.toBeInTheDocument()
  })
})
