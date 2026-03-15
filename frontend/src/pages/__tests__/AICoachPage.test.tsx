import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/useAICoach', () => ({
  useAICoach: () => ({
    loading: false,
    error: '',
    currentWorkout: null,
    generate: vi.fn(),
    clearError: vi.fn(),
  }),
}))

vi.mock('@/components/ai-coach/TemplateSelector', () => ({
  default: ({ onSelect }: any) => (
    <div data-testid="template-selector">
      <button onClick={() => onSelect('sprint workout')}>Select Template</button>
    </div>
  ),
}))

vi.mock('@/components/ai-coach/WorkoutOutput', () => ({
  default: () => <div data-testid="workout-output" />,
}))

vi.mock('@/components/ai-coach/PromptTips', () => ({
  default: () => <div data-testid="prompt-tips" />,
}))

vi.mock('@/components/ai-coach/BestTimesInput', () => ({
  default: () => <div data-testid="best-times-input" />,
}))

import AICoachPage from '../AICoachPage'

describe('AICoachPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('renders template selector', () => {
    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('template-selector')).toBeInTheDocument()
  })

  it('renders generate button', () => {
    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
  })
})
