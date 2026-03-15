import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import RealtimeWorkoutAnalyzer from '../RealtimeWorkoutAnalyzer'

// Mock workoutAnalysisService
vi.mock('@/services/workoutAnalysisService', () => ({
  analyzeWorkout: vi.fn().mockResolvedValue({
    total_meters: 2000,
    total_sets: 5,
    estimated_duration_minutes: 60,
    swim_time_minutes: 45,
    estimated_calories: 400,
    stroke_breakdown: {
      freestyle: 1500,
      backstroke: 500,
    },
    stroke_percentages: {
      freestyle: 75,
      backstroke: 25,
    },
    activity_breakdown: {
      swim: 1600,
      kick: 400,
    },
    activity_percentages: {
      swim: 80,
      kick: 20,
    },
    sets_details: [],
  }),
}))

// Mock useAnimatedValues hook
vi.mock('@/hooks/useAnimatedValue', () => ({
  useAnimatedValues: (values: Record<string, number>) => values,
}))

describe('RealtimeWorkoutAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<RealtimeWorkoutAnalyzer workoutText="" />)
    expect(document.body).toBeTruthy()
  })

  it('shows empty state prompt when workoutText is empty', () => {
    render(<RealtimeWorkoutAnalyzer workoutText="" />)
    expect(screen.getByText(/start typing your workout/i)).toBeInTheDocument()
  })

  it('shows Workout Analysis heading', () => {
    render(<RealtimeWorkoutAnalyzer workoutText="" />)
    expect(screen.getByText('Workout Analysis')).toBeInTheDocument()
  })

  it('shows real-time metrics subtitle', () => {
    render(<RealtimeWorkoutAnalyzer workoutText="" />)
    expect(screen.getByText(/real-time metrics/i)).toBeInTheDocument()
  })

  it('renders with workout text without crashing', () => {
    render(
      <RealtimeWorkoutAnalyzer workoutText="4x100 freestyle swim" />
    )
    // Should render the component (may show loading or analysis)
    expect(document.body).toBeTruthy()
  })
})
