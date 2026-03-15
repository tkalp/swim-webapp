import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import GlobalNav from '../GlobalNav'

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'coach@example.com', user_metadata: { full_name: 'Coach Test' } },
    session: null,
    loading: false,
    coachProfile: null,
    coachLoading: false,
    isAdmin: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    updatePassword: vi.fn(),
  }),
}))

// Mock useFeatureFlags
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    hasTimeStandards: false,
    hasQualifiers: false,
  }),
}))

// Mock SwimmerSearchBar to avoid its complex deps
vi.mock('@/components/swimmers/SwimmerSearchBar', () => ({
  SwimmerSearchBar: () => <div data-testid="swimmer-search-bar" />,
}))

// Mock NotificationBell to avoid its complex deps
vi.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

describe('GlobalNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<GlobalNav />)
    expect(document.body).toBeTruthy()
  })

  it('renders the aquilus brand name', () => {
    render(<GlobalNav />)
    expect(screen.getByText('aquilus')).toBeInTheDocument()
  })

  it('renders the Squads nav link', () => {
    render(<GlobalNav />)
    const squadLinks = screen.getAllByText('Squads')
    expect(squadLinks.length).toBeGreaterThan(0)
  })

  it('renders the Workouts nav link', () => {
    render(<GlobalNav />)
    const workoutLinks = screen.getAllByText('Workouts')
    expect(workoutLinks.length).toBeGreaterThan(0)
  })

  it('renders the swimmer search bar', () => {
    render(<GlobalNav />)
    expect(screen.getByTestId('swimmer-search-bar')).toBeInTheDocument()
  })

  it('renders the notification bell', () => {
    render(<GlobalNav />)
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
  })

  it('renders AI Coach nav link', () => {
    render(<GlobalNav />)
    const aiCoachLinks = screen.getAllByText('AI Coach')
    expect(aiCoachLinks.length).toBeGreaterThan(0)
  })

  it('renders Create button in quick create menu', () => {
    render(<GlobalNav />)
    expect(screen.getByTitle('Quick Create')).toBeInTheDocument()
  })
})
