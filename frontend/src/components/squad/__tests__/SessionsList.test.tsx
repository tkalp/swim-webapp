import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SessionsList from '../SessionsList'
import type { Session } from '../SessionsList'
import type { TrainingSchedule } from '@/services/sessionService'

// Mock useSessionApi
vi.mock('@/hooks/api', () => ({
  useSessionApi: () => ({
    fetchSessions: vi.fn(),
    createSession: vi.fn().mockResolvedValue({}),
    updateSession: vi.fn().mockResolvedValue({}),
    deleteSession: vi.fn().mockResolvedValue({}),
  }),
}))

// Mock useScheduleApi (if used)
vi.mock('@/hooks/api/useScheduleApi', () => ({
  useScheduleApi: () => ({
    fetchSchedules: vi.fn(),
  }),
}))

// Mock child components to keep tests focused
vi.mock('@/components/squad/sessions/AddEditSessionModal', () => ({
  default: () => <div data-testid="add-edit-session-modal" />,
}))

vi.mock('@/components/squad/sessions/CreateFromScheduleModal', () => ({
  default: () => <div data-testid="create-from-schedule-modal" />,
}))

vi.mock('@/components/squad/sessions/AttendanceModal', () => ({
  default: () => <div data-testid="attendance-modal" />,
}))

vi.mock('@/components/squad/sessions/PracticeNotesModal', () => ({
  default: () => <div data-testid="practice-notes-modal" />,
}))

vi.mock('@/components/workouts/SelectWorkoutToAssignModal', () => ({
  SelectWorkoutToAssignModal: () => <div data-testid="select-workout-modal" />,
}))

vi.mock('@/components/workouts/RateWorkoutModal', () => ({
  default: () => <div data-testid="rate-workout-modal" />,
}))

vi.mock('@/components/workout/WorkoutMiniChart', () => ({
  default: () => <div data-testid="workout-mini-chart" />,
}))

vi.mock('@/components/ui/DateInput', () => ({
  default: ({ placeholder }: { placeholder: string }) => (
    <input data-testid={`date-input-${placeholder}`} />
  ),
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: () => <div data-testid="confirm-dialog" />,
}))

vi.mock('@/components/squad/SquadPageHeader', () => ({
  SquadPageHeader: ({ title }: { title: string }) => (
    <div data-testid="squad-page-header">{title}</div>
  ),
}))

// Mock sessionService
vi.mock('@/services/sessionService', () => ({
  createSessionsFromSchedules: vi.fn().mockResolvedValue({ created: [], errors: [] }),
}))

// Mock stores used by useSessionApi (Zustand)
vi.mock('@/stores/squadStore', () => ({
  useSquadStore: () => ({
    setSessions: vi.fn(),
    addSession: vi.fn(),
    updateSessionInStore: vi.fn(),
    removeSession: vi.fn(),
  }),
}))

vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => ({
    addToast: vi.fn(),
  }),
}))

// Mock CSS import
vi.mock('@/styles/SessionsList.css', () => ({}))

// Mock ToastContext
vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

// Fixtures
const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  training_type: 'Swim',
  start_date: '2026-03-10T06:00:00.000Z',
  end_date: '2026-03-10T07:30:00.000Z',
  workout_id: null,
  workout_name: null,
  is_virtual: false,
  ...overrides,
})

const defaultProps = {
  sessions: [] as Session[],
  squadId: 'squad-1',
  schedules: [] as TrainingSchedule[],
  canManage: false,
  canManageAttendance: false,
}

describe('SessionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default localStorage values
    localStorage.clear()
    // Set date range to "all" so all sessions are visible regardless of date
    localStorage.setItem('sessions-date-range', 'all')
  })

  it('renders the header with "Training Sessions" title', () => {
    render(<SessionsList {...defaultProps} />)
    expect(screen.getByTestId('squad-page-header')).toHaveTextContent('Training Sessions')
  })

  it('shows empty state when no sessions provided', () => {
    render(<SessionsList {...defaultProps} sessions={[]} />)
    expect(screen.getByText('No sessions found')).toBeInTheDocument()
  })

  it('renders session cards when sessions are provided', () => {
    const sessions = [
      makeSession({ id: 'session-1', training_type: 'Swim' }),
      makeSession({ id: 'session-2', training_type: 'Kick' }),
    ]
    render(<SessionsList {...defaultProps} sessions={sessions} />)

    // Both session training types should appear as badges
    expect(screen.getAllByText('Swim')).toHaveLength(1)
    expect(screen.getAllByText('Kick')).toHaveLength(1)
  })

  it('shows "Scheduled" badge for virtual sessions', () => {
    const sessions = [
      makeSession({ id: 'session-1', is_virtual: true }),
      makeSession({ id: 'session-2', is_virtual: false }),
    ]
    render(<SessionsList {...defaultProps} sessions={sessions} />)

    const badges = screen.getAllByText('Scheduled')
    expect(badges).toHaveLength(1)
  })

  it('does not show "Scheduled" badge for non-virtual sessions', () => {
    const sessions = [makeSession({ id: 'session-1', is_virtual: false })]
    render(<SessionsList {...defaultProps} sessions={sessions} />)
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument()
  })

  it('renders date filter buttons', () => {
    render(<SessionsList {...defaultProps} />)

    expect(screen.getByText('This Week')).toBeInTheDocument()
    expect(screen.getByText('Next Week')).toBeInTheDocument()
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument()
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument()
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('All Time')).toBeInTheDocument()
  })

  it('shows Add Session button when canManage=true', () => {
    render(<SessionsList {...defaultProps} canManage={true} />)
    expect(screen.getByText('Add Session')).toBeInTheDocument()
  })

  it('does not show Add Session button when canManage=false', () => {
    render(<SessionsList {...defaultProps} canManage={false} />)
    expect(screen.queryByText('Add Session')).not.toBeInTheDocument()
  })

  it('shows stats summary when sessions are present', () => {
    const sessions = [makeSession({ id: 'session-1' })]
    render(<SessionsList {...defaultProps} sessions={sessions} />)

    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('Total Minutes')).toBeInTheDocument()
    expect(screen.getByText('With Workout')).toBeInTheDocument()
  })

  it('shows workout name badge when session has a workout', () => {
    const sessions = [
      makeSession({
        id: 'session-1',
        workout_id: 'workout-1',
        workout_name: 'Sprint Set',
      }),
    ]
    render(<SessionsList {...defaultProps} sessions={sessions} />)
    expect(screen.getByText('Sprint Set')).toBeInTheDocument()
  })
})
