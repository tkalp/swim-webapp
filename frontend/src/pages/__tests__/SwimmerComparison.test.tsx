import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'coach-1', email: 'coach@test.com', user_metadata: {} },
  }),
}))

vi.mock('@/services/squadService', () => ({
  compareSwimmers: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

vi.mock('@/services/workoutResultService', () => ({
  formatTime: vi.fn((t: number) => String(t)),
}))

vi.mock('@/components/SwimmerSelect', () => ({
  default: ({ label }: any) => <div data-testid="swimmer-select">{label}</div>,
}))

import SwimmerComparisonPage from '../SwimmerComparison'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SwimmerComparisonPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SwimmerComparisonPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page heading', () => {
    renderPage()
    expect(screen.getByText('Swimmer Comparison')).toBeInTheDocument()
  })

  it('renders swimmer select dropdowns', () => {
    renderPage()
    const selects = screen.getAllByTestId('swimmer-select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
  })
})
