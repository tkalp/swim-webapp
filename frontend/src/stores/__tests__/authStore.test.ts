import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuthStore } from '../authStore'
import { mockUser, mockSupabaseSuccess, mockSupabaseError } from '../../__tests__/testUtils'
import { mockSupabaseClient } from '../../__tests__/setup'

describe('authStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAuthStore.setState({ session: null, user: null, loading: false })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have null user and session initially', () => {
      const { result } = renderHook(() => useAuthStore())
      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
    })
  })

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockSession = { user: mockUser, access_token: 'token', refresh_token: 'refresh' }
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: mockSession, user: mockUser },
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      let signInResult: any
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'password')
      })

      expect(signInResult.error).toBeUndefined()
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      })
    })

    it('should handle sign in error', async () => {
      const errorMessage = 'Invalid credentials'
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: errorMessage },
      })

      const { result } = renderHook(() => useAuthStore())

      let signInResult: any
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'wrong-password')
      })

      expect(signInResult.error).toBeDefined()
      expect(signInResult.error.message).toBe(errorMessage)
    })
  })

  describe('signOut', () => {
    it('should sign out user and clear state', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: null })

      const { result } = renderHook(() => useAuthStore())

      // Set a user first
      act(() => {
        result.current.setSession({ user: mockUser, access_token: 'token' } as any)
      })

      expect(result.current.user).toEqual(mockUser)

      await act(async () => {
        await result.current.signOut()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })
  })

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail = vi.fn().mockResolvedValueOnce({
        data: {},
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      let resetResult: any
      await act(async () => {
        resetResult = await result.current.sendPasswordResetEmail('test@example.com')
      })

      expect(resetResult.error).toBeUndefined()
    })

    it('should handle password reset error', async () => {
      const errorMessage = 'Invalid email'
      mockSupabaseClient.auth.resetPasswordForEmail = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: errorMessage },
      })

      const { result } = renderHook(() => useAuthStore())

      let resetResult: any
      await act(async () => {
        resetResult = await result.current.sendPasswordResetEmail('invalid@example.com')
      })

      expect(resetResult.error).toBeDefined()
      expect(resetResult.error.message).toBe(errorMessage)
    })
  })

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      mockSupabaseClient.auth.updateUser = vi.fn().mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      let updateResult: any
      await act(async () => {
        updateResult = await result.current.updatePassword('newPassword123')
      })

      expect(updateResult.error).toBeUndefined()
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({ password: 'newPassword123' })
    })
  })

  describe('setSession', () => {
    it('should set session and user', () => {
      const { result } = renderHook(() => useAuthStore())
      const mockSession = { user: mockUser, access_token: 'token' } as any

      act(() => {
        result.current.setSession(mockSession)
      })

      expect(result.current.session).toEqual(mockSession)
      expect(result.current.user).toEqual(mockUser)
    })

    it('should clear user when session is null', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setSession({ user: mockUser } as any)
        result.current.setSession(null)
      })

      expect(result.current.session).toBeNull()
      expect(result.current.user).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.loading).toBe(false)
    })
  })

  describe('initialize', () => {
    it('should initialize with existing session', async () => {
      const mockSession = { user: mockUser, access_token: 'token' }
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.initialize()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('should handle no existing session', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.initialize()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })
})
