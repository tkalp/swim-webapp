import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/lib/mixpanel', () => ({
  analytics: {
    track: vi.fn(),
  },
}))

vi.mock('@/components/landing/MiniAnalyticsChart', () => ({
  default: () => <div data-testid="mini-analytics-chart" />,
}))

vi.mock('@/components/landing/MiniAthleteProfile', () => ({
  default: () => <div data-testid="mini-athlete-profile" />,
}))

vi.mock('@/components/landing/MiniWorkoutLibrary', () => ({
  default: () => <div data-testid="mini-workout-library" />,
}))

vi.mock('@/components/landing/MiniAICoach', () => ({
  default: () => <div data-testid="mini-ai-coach" />,
}))

import LandingPage from '../LandingPage'

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('renders Join Waitlist CTA', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    )
    expect(screen.getAllByText(/join waitlist/i).length).toBeGreaterThan(0)
  })
})
