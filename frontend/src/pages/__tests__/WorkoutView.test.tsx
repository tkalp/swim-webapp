import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ workoutId: 'workout-1' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/hooks/useWorkout', () => ({
  default: () => ({
    fetchWorkout: vi.fn().mockResolvedValue({
      id: 'workout-1',
      name: 'Test Workout',
      rawDescription: 'Warm up\n200m freestyle\nCooldown',
      description: 'A test workout',
      totalMeters: 2000,
      estimatedTimeMinutes: 60,
      estimatedCalories: 400,
      effortLevel: 5,
      createdAt: '2025-01-01T00:00:00Z',
      jsonDescription: null,
    }),
    workoutLoading: false,
  }),
}))

vi.mock('@/services/workoutTagService', () => ({
  getWorkoutTags: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/services/workoutTemplateService', () => ({
  deleteWorkoutTemplate: vi.fn(),
}))

vi.mock('@/components/workout/WorkoutBreakdownCharts', () => ({
  default: () => <div data-testid="breakdown-charts" />,
}))

import WorkoutViewPage from '../WorkoutView'

describe('WorkoutViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    render(
      <MemoryRouter>
        <WorkoutViewPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/loading workout/i)).toBeInTheDocument()
  })

  it('renders workout name after loading', async () => {
    const { findByText } = render(
      <MemoryRouter>
        <WorkoutViewPage />
      </MemoryRouter>
    )
    expect(await findByText('Test Workout')).toBeInTheDocument()
  })

  it('shows workout stats after loading', async () => {
    const { findByText } = render(
      <MemoryRouter>
        <WorkoutViewPage />
      </MemoryRouter>
    )
    expect(await findByText('2,000')).toBeInTheDocument()
  })
})
