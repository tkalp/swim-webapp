import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuthStore } from '../authStore'

const API_BASE_URL = 'http://localhost:8000'

const mockBackendUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
}

const mockTokenResponse = {
  access_token: 'new-access-token',
  refresh_token: 'new-refresh-token',
  user: mockBackendUser,
}

function mockFetch(responses: Array<{ ok: boolean; body: unknown; status?: number }>) {
  let callIndex = 0
  return vi.fn().mockImplementation(() => {
    const r = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: () => Promise.resolve(r.body),
    })
  })
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, user: null, loading: false, coachProfile: null })
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('has null user and session initially', () => {
      const { result } = renderHook(() => useAuthStore())
      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
    })
  })

  describe('signIn', () => {
    it('sets session and user on success', async () => {
      global.fetch = mockFetch([
        { ok: true, body: mockTokenResponse },          // POST /auth/login
        { ok: true, body: { id: 'coach-1', is_coach: true, role: null, user_id: 'test-user-id' } }, // GET /coaches/me
      ])

      const { result } = renderHook(() => useAuthStore())

      let signInResult: { error?: Error }
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'password')
      })

      expect(signInResult!.error).toBeUndefined()
      expect(result.current.user).not.toBeNull()
      expect(result.current.user?.email).toBe('test@example.com')
      expect(result.current.session?.access_token).toBe('new-access-token')
      expect(localStorage.getItem('access_token')).toBe('new-access-token')
    })

    it('returns error on failed login', async () => {
      global.fetch = mockFetch([
        { ok: false, status: 401, body: { detail: 'Invalid credentials' } },
      ])

      const { result } = renderHook(() => useAuthStore())

      let signInResult: { error?: Error }
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'wrong')
      })

      expect(signInResult!.error).toBeDefined()
      expect(signInResult!.error?.message).toBe('Invalid credentials')
      expect(result.current.user).toBeNull()
    })
  })

  describe('signOut', () => {
    it('clears session, user, and tokens', async () => {
      // Prime with a session
      useAuthStore.setState({
        session: { access_token: 'tok', refresh_token: 'ref', user: { id: 'u1', email: 'a@b.com', user_metadata: {} } },
        user: { id: 'u1', email: 'a@b.com', user_metadata: {} },
      })
      localStorage.setItem('access_token', 'tok')
      localStorage.setItem('refresh_token', 'ref')

      global.fetch = mockFetch([{ ok: true, body: {} }]) // POST /auth/logout (fire-and-forget)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signOut()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
      expect(localStorage.getItem('access_token')).toBeNull()
    })
  })

  describe('setSession', () => {
    it('sets session and user', () => {
      const { result } = renderHook(() => useAuthStore())
      const mockSession = {
        access_token: 'tok',
        refresh_token: 'ref',
        user: { id: 'u1', email: 'a@b.com', user_metadata: {} },
      }

      act(() => {
        result.current.setSession(mockSession)
      })

      expect(result.current.session).toEqual(mockSession)
      expect(result.current.user).toEqual(mockSession.user)
    })

    it('clears user when session is null', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setSession({
          access_token: 'tok',
          refresh_token: 'ref',
          user: { id: 'u1', email: 'a@b.com', user_metadata: {} },
        })
        result.current.setSession(null)
      })

      expect(result.current.session).toBeNull()
      expect(result.current.user).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('updates loading state', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => result.current.setLoading(true))
      expect(result.current.loading).toBe(true)

      act(() => result.current.setLoading(false))
      expect(result.current.loading).toBe(false)
    })
  })

  describe('sendPasswordResetEmail', () => {
    it('returns no error on success', async () => {
      global.fetch = mockFetch([{ ok: true, body: {} }])
      const { result } = renderHook(() => useAuthStore())

      let r: { error?: Error }
      await act(async () => {
        r = await result.current.sendPasswordResetEmail('test@example.com')
      })

      expect(r!.error).toBeUndefined()
    })

    it('returns error on failure', async () => {
      global.fetch = mockFetch([{ ok: false, status: 400, body: { detail: 'Invalid email' } }])
      const { result } = renderHook(() => useAuthStore())

      let r: { error?: Error }
      await act(async () => {
        r = await result.current.sendPasswordResetEmail('bad@example.com')
      })

      expect(r!.error).toBeDefined()
      expect(r!.error?.message).toBe('Invalid email')
    })
  })

  describe('updatePassword', () => {
    it('returns no error on success', async () => {
      global.fetch = mockFetch([{ ok: true, body: {} }])
      const { result } = renderHook(() => useAuthStore())

      let r: { error?: Error }
      await act(async () => {
        r = await result.current.updatePassword('reset-token', 'NewPass123!')
      })

      expect(r!.error).toBeUndefined()
    })
  })

  describe('refreshSession', () => {
    it('updates tokens and user on success', async () => {
      localStorage.setItem('refresh_token', 'old-refresh')
      global.fetch = mockFetch([
        { ok: true, body: mockTokenResponse },          // POST /auth/refresh
        { ok: true, body: mockBackendUser },             // GET /auth/me
      ])

      const { result } = renderHook(() => useAuthStore())

      let refreshed: boolean
      await act(async () => {
        refreshed = await result.current.refreshSession()
      })

      expect(refreshed!).toBe(true)
      expect(result.current.user?.email).toBe('test@example.com')
      expect(localStorage.getItem('access_token')).toBe('new-access-token')
    })

    it('clears state and returns false when refresh fails', async () => {
      localStorage.setItem('refresh_token', 'expired-refresh')
      global.fetch = mockFetch([{ ok: false, status: 401, body: {} }])

      const { result } = renderHook(() => useAuthStore())

      let refreshed: boolean
      await act(async () => {
        refreshed = await result.current.refreshSession()
      })

      expect(refreshed!).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
    })

    it('returns false immediately when no refresh token is stored', async () => {
      const { result } = renderHook(() => useAuthStore())

      let refreshed: boolean
      await act(async () => {
        refreshed = await result.current.refreshSession()
      })

      expect(refreshed!).toBe(false)
    })
  })

  describe('initialize', () => {
    it('sets user from /auth/me when access token is valid', async () => {
      localStorage.setItem('access_token', 'valid-token')
      localStorage.setItem('refresh_token', 'valid-refresh')
      global.fetch = mockFetch([
        { ok: true, body: mockBackendUser },           // GET /auth/me
        { ok: true, body: { id: 'coach-1', is_coach: true, role: null, user_id: 'test-user-id' } }, // GET /coaches/me
      ])

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.initialize()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user?.email).toBe('test@example.com')
    })

    it('sets loading false and clears state when no token stored', async () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.initialize()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
    })
  })
})
