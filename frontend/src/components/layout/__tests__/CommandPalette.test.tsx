import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPalette } from '../CommandPalette'

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

// Mock squadService
vi.mock('@/services/squadService', () => ({
  getSquadsForCoach: vi.fn().mockResolvedValue([]),
}))

function renderCommandPalette(props: { isOpen: boolean; onClose?: () => void }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CommandPalette isOpen={props.isOpen} onClose={props.onClose ?? vi.fn()} />
    </QueryClientProvider>
  )
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    renderCommandPalette({ isOpen: false })
    expect(screen.queryByPlaceholderText(/search commands/i)).not.toBeInTheDocument()
  })

  it('renders search input when open', () => {
    renderCommandPalette({ isOpen: true })
    expect(screen.getByPlaceholderText(/search commands/i)).toBeInTheDocument()
  })

  it('shows navigation commands when open', () => {
    renderCommandPalette({ isOpen: true })
    expect(screen.getByText(/go to home/i)).toBeInTheDocument()
    expect(screen.getByText(/go to squads/i)).toBeInTheDocument()
  })

  it('shows create commands', () => {
    renderCommandPalette({ isOpen: true })
    expect(screen.getByText(/create new workout/i)).toBeInTheDocument()
  })

  it('filters commands when typing in search', () => {
    renderCommandPalette({ isOpen: true })
    const input = screen.getByPlaceholderText(/search commands/i)
    fireEvent.change(input, { target: { value: 'workout' } })
    // workout-related commands should still be visible
    expect(screen.getByText(/create new workout/i)).toBeInTheDocument()
    // home-only navigation should be filtered out
    expect(screen.queryByText(/go to home/i)).not.toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    renderCommandPalette({ isOpen: true, onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows "No commands found" when search has no results', () => {
    renderCommandPalette({ isOpen: true })
    const input = screen.getByPlaceholderText(/search commands/i)
    fireEvent.change(input, { target: { value: 'xyzzy-nonexistent-12345' } })
    expect(screen.getByText(/no commands found/i)).toBeInTheDocument()
  })
})
