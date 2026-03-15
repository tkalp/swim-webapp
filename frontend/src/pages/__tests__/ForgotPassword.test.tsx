import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../ForgotPassword'

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

// Mock ui Copyright component
vi.mock('@/components/ui', () => ({
  Copyright: () => <div data-testid="copyright" />,
}))

const mockSendPasswordResetEmail = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    sendPasswordResetEmail: mockSendPasswordResetEmail,
  }),
}))

function renderForgotPassword() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  )
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendPasswordResetEmail.mockResolvedValue({})
  })

  it('renders email input', () => {
    renderForgotPassword()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
  })

  it('renders send reset link button', () => {
    renderForgotPassword()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('renders back to login link', () => {
    renderForgotPassword()
    expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument()
  })

  it('calls sendPasswordResetEmail with entered email on submit', async () => {
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'coach@example.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form')!)

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('coach@example.com')
    })
  })

  it('shows success message after successful submission', async () => {
    mockSendPasswordResetEmail.mockResolvedValue({})
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'coach@example.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/check your email for reset instructions/i)).toBeInTheDocument()
    })
  })

  it('shows error message when sendPasswordResetEmail fails', async () => {
    mockSendPasswordResetEmail.mockResolvedValue({ error: new Error('Email not found') })
    renderForgotPassword()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'unknown@example.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Email not found')).toBeInTheDocument()
    })
  })
})
