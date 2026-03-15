import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

// Mock logo asset
vi.mock('@/assets/logo.png', () => ({ default: 'logo.png' }))

// Mock UI components
vi.mock('@/components/ui', () => ({
  Input: ({ label, type, value, onChange, placeholder, required, disabled }: any) => (
    <div>
      <label>{label}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
        />
      </label>
    </div>
  ),
  Button: ({ children, type, loading, loadingText, disabled }: any) => (
    <button type={type} disabled={disabled || loading}>
      {loading ? loadingText : children}
    </button>
  ),
  Copyright: () => <div data-testid="copyright" />,
}))

const mockSignIn = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    signIn: mockSignIn,
  }),
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({})
  })

  it('renders email and password inputs', () => {
    renderLogin()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders forgot password link', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
  })

  it('calls signIn with entered credentials on submit', async () => {
    renderLogin()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'coach@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'mypassword' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('coach@example.com', 'mypassword')
    })
  })

  it('shows error message when signIn returns an error', async () => {
    mockSignIn.mockResolvedValue({ error: new Error('Invalid credentials') })
    renderLogin()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'coach@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })
})
