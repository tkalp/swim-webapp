import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'coach-1', email: 'coach@test.com', user_metadata: {} },
  }),
}))

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/services/workoutLibraryService', () => ({
  getCoachWorkouts: vi.fn().mockResolvedValue({ workouts: [], hasMore: false, total: 0 }),
  deleteWorkout: vi.fn(),
  duplicateWorkout: vi.fn(),
}))

vi.mock('@/services/workoutTagService', () => ({
  getCoachTags: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/services/workoutSharingService', () => ({
  updateWorkoutVisibility: vi.fn(),
}))

vi.mock('@/components/workout/WorkoutMiniChart', () => ({
  default: () => <div data-testid="workout-mini-chart" />,
}))

vi.mock('@/components/workout/WorkoutTag', () => ({
  WorkoutTag: () => <div data-testid="workout-tag" />,
}))

vi.mock('@/components/workouts/WorkoutRatingStars', () => ({
  default: () => <div data-testid="workout-rating-stars" />,
}))

vi.mock('@/components/workouts/AssignWorkoutToSessionModal', () => ({
  AssignWorkoutToSessionModal: () => null,
}))

vi.mock('@/components/workouts/WorkoutVisibilityBadge', () => ({
  default: () => <div data-testid="visibility-badge" />,
}))

vi.mock('@/components/ui/MultiSelectDropdown', () => ({
  default: () => <div data-testid="multi-select" />,
}))

import WorkoutsLibrary from '../WorkoutsLibrary'

describe('WorkoutsLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page heading', () => {
    render(
      <MemoryRouter>
        <WorkoutsLibrary />
      </MemoryRouter>
    )
    expect(screen.getByText('Workout Library')).toBeInTheDocument()
  })

  it('renders create workout button', () => {
    render(
      <MemoryRouter>
        <WorkoutsLibrary />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /create workout/i })).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(
      <MemoryRouter>
        <WorkoutsLibrary />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText(/search workouts/i)).toBeInTheDocument()
  })
})
