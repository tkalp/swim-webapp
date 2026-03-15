import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SquadQualifiersTab from '../SquadQualifiersTab'

// Mock useSquadQualifiers hook
const mockUseSquadQualifiersOptimized = vi.fn()

vi.mock('@/hooks/useSquadQualifiers', () => ({
  useSquadQualifiersOptimized: (...args: any[]) =>
    mockUseSquadQualifiersOptimized(...args),
}))

// Mock StandardsSelector — it makes API calls internally
vi.mock('@/components/swimmers/timeStandards', () => ({
  StandardsSelector: ({
    onSetChange,
  }: {
    selectedSetId: string | null
    onSetChange: (id: string | null) => void
  }) => (
    <div data-testid="standards-selector">
      <button
        data-testid="select-standard-btn"
        onClick={() => onSetChange('standards-set-1')}
      >
        Select Standards
      </button>
    </div>
  ),
  StandardsCell: () => <div data-testid="standards-cell" />,
}))

// Mock qualifiers sub-components
vi.mock('../QualifiersSummary', () => ({
  QualifiersSummary: ({
    totalSwimmers,
    totalQualified,
    totalClose,
  }: {
    totalSwimmers: number
    totalQualified: number
    totalClose: number
  }) => (
    <div data-testid="qualifiers-summary">
      <span data-testid="total-swimmers">{totalSwimmers}</span>
      <span data-testid="total-qualified">{totalQualified}</span>
      <span data-testid="total-close">{totalClose}</span>
    </div>
  ),
}))

vi.mock('../QualifiersTable', () => ({
  QualifiersTable: ({ swimmers }: { swimmers: any[] }) => (
    <div data-testid="qualifiers-table">
      {swimmers.map((sq) => (
        <div key={sq.swimmer.id} data-testid={`qualifier-row-${sq.swimmer.id}`}>
          {sq.swimmer.first_name} {sq.swimmer.last_name}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../QualifiersFilters', () => ({
  QualifiersFilters: () => <div data-testid="qualifiers-filters" />,
}))

// Mock apiClient (used for loading standards)
vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
  },
}))

// Mock utility functions used by the component
vi.mock('@/services/swimmerStandards', () => ({
  calculateSwimmerAge: () => 16,
  mapGenderToStandards: (sex: string) => (sex === 'M' ? 'M' : 'F'),
  timeStringToSeconds: (t: string) => 60,
  getStandardsForEvent: () => null,
}))

vi.mock('@/utils/timeUtils', () => ({
  formatTime: (s: number) => `${s}s`,
}))

const mockSwimmersData = {
  swimmers: [
    {
      swimmer_id: 'swimmer-1',
      first_name: 'Alice',
      last_name: 'Johnson',
      date_of_birth: '2008-05-15',
      sex: 'F',
      best_times: [],
    },
    {
      swimmer_id: 'swimmer-2',
      first_name: 'Bob',
      last_name: 'Williams',
      date_of_birth: '2007-11-20',
      sex: 'M',
      best_times: [],
    },
  ],
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('SquadQualifiersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSquadQualifiersOptimized.mockReturnValue({
      data: mockSwimmersData,
      isLoading: false,
      error: null,
    })
  })

  it('renders without crashing', () => {
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)
    expect(screen.getByText('Qualifiers')).toBeInTheDocument()
  })

  it('shows loading spinner when data is loading', () => {
    mockUseSquadQualifiersOptimized.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    const { container } = renderWithQueryClient(
      <SquadQualifiersTab squadId="squad-1" />
    )
    // Spinner uses animate-spin class
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows error message when query fails', () => {
    mockUseSquadQualifiersOptimized.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load squad data'),
    })

    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)
    expect(screen.getByText(/Failed to load squad data/)).toBeInTheDocument()
  })

  it('renders StandardsSelector to let user choose a standards set', () => {
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)
    expect(screen.getByTestId('standards-selector')).toBeInTheDocument()
  })

  it('shows "Select a time standards set" prompt before a set is chosen', () => {
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)
    expect(
      screen.getByText('Select a time standards set to view qualifications')
    ).toBeInTheDocument()
  })

  it('renders pool type filter buttons (SCM / LCM)', async () => {
    // Simulate having a standards set selected by rendering with a pre-selected set
    // We need to click "Select Standards" to trigger the state change
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)

    const selectBtn = screen.getByTestId('select-standard-btn')
    selectBtn.click()

    await waitFor(() => {
      expect(screen.getByText('SCM (25m)')).toBeInTheDocument()
      expect(screen.getByText('LCM (50m)')).toBeInTheDocument()
    })
  })

  it('shows qualifiers summary after standards are selected', async () => {
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)

    screen.getByTestId('select-standard-btn').click()

    await waitFor(() => {
      expect(screen.getByTestId('qualifiers-summary')).toBeInTheDocument()
    })
  })

  it('shows qualifiers table with swimmer rows after standards are selected', async () => {
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)

    screen.getByTestId('select-standard-btn').click()

    await waitFor(() => {
      expect(screen.getByTestId('qualifiers-table')).toBeInTheDocument()
      expect(screen.getByTestId('qualifier-row-swimmer-1')).toBeInTheDocument()
      expect(screen.getByTestId('qualifier-row-swimmer-2')).toBeInTheDocument()
    })
  })

  it('displays squad description subtitle', () => {
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-1" />)
    expect(
      screen.getByText(
        'View swimmer qualification status for selected time standards'
      )
    ).toBeInTheDocument()
  })

  it('calls useSquadQualifiersOptimized with the correct squadId', () => {
    renderWithQueryClient(<SquadQualifiersTab squadId="squad-42" />)
    expect(mockUseSquadQualifiersOptimized).toHaveBeenCalledWith('squad-42')
  })
})
