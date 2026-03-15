import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from '../ResetPassword'

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

// Mock ui Copyright component
vi.mock('@/components/ui', () => ({
  Copyright: () => <div data-testid="copyright" />,
}))

const mockUpdatePassword = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    updatePassword: mockUpdatePassword,
  }),
}))

// Override navigate mock from setup.ts
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams({ token: 'valid-reset-token' }), vi.fn()],
  }
})

function renderResetPassword() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  )
}

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdatePassword.mockResolvedValue({})
  })

  it('renders new password and confirm password inputs', () => {
    renderResetPassword()
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
  })

  it('renders reset password button', () => {
    renderResetPassword()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('shows validation error when passwords do not match', async () => {
    renderResetPassword()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'ValidPass1' },
    })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'DifferentPass1' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('shows validation error when password is too short', async () => {
    renderResetPassword()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'Short1' },
    })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'Short1' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('calls updatePassword with token and new password on valid submit', async () => {
    renderResetPassword()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'ValidPass1' },
    })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'ValidPass1' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('valid-reset-token', 'ValidPass1')
    })
  })

  it('shows success state and navigates to login after successful reset', async () => {
    vi.useFakeTimers()
    mockUpdatePassword.mockResolvedValue({})
    renderResetPassword()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'ValidPass1' },
    })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'ValidPass1' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/password has been successfully reset/i)).toBeInTheDocument()
    })

    // Advance timer for the setTimeout redirect
    vi.advanceTimersByTime(3000)
    expect(mockNavigate).toHaveBeenCalledWith('/login')

    vi.useRealTimers()
  })

  it('shows error message when updatePassword fails', async () => {
    mockUpdatePassword.mockResolvedValue({ error: new Error('Token expired') })
    renderResetPassword()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'ValidPass1' },
    })
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'ValidPass1' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /reset password/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument()
    })
  })
})
