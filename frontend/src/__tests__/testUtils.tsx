import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialRoute = '/', ...renderOptions } = options || {}

  function Wrapper({ children }: { children: ReactNode }) {
    if (initialRoute !== '/') {
      window.history.pushState({}, 'Test page', initialRoute)
    }
    
    return <BrowserRouter>{children}</BrowserRouter>
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { renderWithProviders as render }

// Mock data helpers
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
}

export const mockSwimmer = {
  id: 'swimmer-1',
  first_name: 'John',
  last_name: 'Doe',
  date_of_birth: '2005-01-01',
  sex: 'Male' as const,
  squad_id: 'squad-1',
  created_at: '2024-01-01T00:00:00Z',
}

export const mockSquad = {
  id: 'squad-1',
  name: 'Test Squad',
  description: 'Test squad description',
  created_at: '2024-01-01T00:00:00Z',
}

export const mockSquadCard = {
  ...mockSquad,
  role: 'owner' as const,
  swimmers_count: 5,
}

export const mockSession = {
  id: 'session-1',
  squad_id: 'squad-1',
  start_date: '2024-01-15T17:00:00Z',
  end_date: '2024-01-15T18:00:00Z',
  training_type: 'Swim',
  workout_id: null,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockSchedule = {
  id: 'schedule-1',
  squad_id: 'squad-1',
  day_of_week: 'Monday' as const,
  start_time: '17:00',
  end_time: '18:00',
  training_type: 'Swim' as const,
  active: true,
  until: null,
  created_at: '2024-01-01T00:00:00Z',
}

// Helper to create mock Supabase responses
export function mockSupabaseSuccess<T>(data: T) {
  return { data, error: null }
}

export function mockSupabaseError(message: string) {
  return { data: null, error: { message, code: 'TEST_ERROR' } }
}

// Wait for async updates
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0))
