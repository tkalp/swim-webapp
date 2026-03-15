import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { analytics } from '@/lib/mixpanel'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

// Helper to get/set tokens in localStorage
function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

/**
 * Map the backend user shape { id, email, full_name }
 * to the shape components expect: { id, email, user_metadata: { full_name } }
 */
interface BackendUser {
  id: string
  email: string
  full_name?: string
}

interface AppUser {
  id: string
  email: string
  user_metadata: {
    full_name?: string
  }
  created_at?: string
}

function mapUser(backendUser: BackendUser): AppUser {
  return {
    id: backendUser.id,
    email: backendUser.email,
    user_metadata: {
      full_name: backendUser.full_name,
    },
  }
}

/**
 * Session object that mirrors what the rest of the app expects.
 * Provides access_token and user for backward compatibility.
 */
interface AppSession {
  access_token: string
  refresh_token: string
  user: AppUser
}

interface CoachProfile {
  id: string
  user_id: string
  role: string | null
  is_coach: boolean
  name?: string
  email?: string
}

interface AuthState {
  // State
  session: AppSession | null
  user: AppUser | null
  loading: boolean
  coachProfile: CoachProfile | null
  coachLoading: boolean

  // Actions
  setSession: (session: AppSession | null) => void
  setLoading: (loading: boolean) => void
  setCoachProfile: (profile: CoachProfile | null) => void
  fetchCoachProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error?: Error }>
  signOut: () => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<{ error?: Error }>
  updatePassword: (token: string, newPassword: string) => Promise<{ error?: Error }>
  refreshSession: () => Promise<boolean>
  initialize: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // Initial state
      session: null,
      user: null,
      loading: true,
      coachProfile: null,
      coachLoading: false,

      // Actions
      setSession: (session) => set({
        session,
        user: session?.user ?? null,
      }),

      setLoading: (loading) => set({ loading }),

      setCoachProfile: (profile) => set({ coachProfile: profile }),

      fetchCoachProfile: async () => {
        const accessToken = getAccessToken()
        if (!accessToken) {
          set({ coachProfile: null, coachLoading: false })
          return
        }

        try {
          set({ coachLoading: true })
          const response = await fetch(`${API_BASE_URL}/coaches/me`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            const profile = await response.json()
            set({ coachProfile: profile, coachLoading: false })
          } else {
            console.error('Failed to fetch coach profile:', response.statusText)
            set({ coachProfile: null, coachLoading: false })
          }
        } catch (error) {
          console.error('Error fetching coach profile:', error)
          set({ coachProfile: null, coachLoading: false })
        }
      },

      signIn: async (email, password) => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            const message = data.detail || data.message || 'Invalid email or password'
            return { error: new Error(message) }
          }

          const data = await response.json()
          storeTokens(data.access_token, data.refresh_token)

          const user = mapUser(data.user)
          const session: AppSession = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            user,
          }

          set({ session, user })

          // Track with analytics
          analytics.identify(user.id)
          analytics.setUser({
            email: user.email,
          })
          analytics.track('User Signed In', { method: 'email' })

          // Fetch coach profile
          get().fetchCoachProfile()

          return {}
        } catch (error) {
          return { error: error instanceof Error ? error : new Error('Sign in failed') }
        }
      },

      signOut: async () => {
        analytics.track('User Signed Out')
        analytics.reset()

        const refreshToken = getRefreshToken()

        // Fire-and-forget the server logout
        if (refreshToken) {
          fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }).catch(() => {
            // Ignore errors — we clear local state regardless
          })
        }

        clearTokens()
        set({ session: null, user: null, coachProfile: null })
      },

      sendPasswordResetEmail: async (email) => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            const message = data.detail || data.message || 'Failed to send reset email'
            return { error: new Error(message) }
          }

          return {}
        } catch (error) {
          return { error: error instanceof Error ? error : new Error('Failed to send reset email') }
        }
      },

      updatePassword: async (token, newPassword) => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: newPassword }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            const message = data.detail || data.message || 'Failed to reset password'
            return { error: new Error(message) }
          }

          return {}
        } catch (error) {
          return { error: error instanceof Error ? error : new Error('Failed to reset password') }
        }
      },

      refreshSession: async () => {
        const refreshToken = getRefreshToken()
        if (!refreshToken) return false

        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          })

          if (!refreshResponse.ok) {
            clearTokens()
            set({ session: null, user: null, coachProfile: null })
            return false
          }

          const tokens = await refreshResponse.json()
          storeTokens(tokens.access_token, tokens.refresh_token)

          // Fetch fresh user data — don't reuse potentially stale store state
          const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
              'Content-Type': 'application/json',
            },
          })

          if (meResponse.ok) {
            const backendUser = await meResponse.json()
            const user = mapUser(backendUser)
            set({
              session: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                user,
              },
              user,
            })
          } else {
            // Tokens are valid but /me failed — keep existing user, update tokens
            const { user } = get()
            if (user) {
              set({
                session: {
                  access_token: tokens.access_token,
                  refresh_token: tokens.refresh_token,
                  user,
                },
              })
            }
          }

          return true
        } catch {
          clearTokens()
          set({ session: null, user: null, coachProfile: null })
          return false
        }
      },

      initialize: () => {
        const accessToken = getAccessToken()

        if (!accessToken) {
          set({ loading: false })
          return
        }

        // Validate the stored token by calling /auth/me
        fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
          .then(async (response) => {
            if (response.ok) {
              const backendUser = await response.json()
              const user = mapUser(backendUser)
              const refreshToken = getRefreshToken() || ''

              const session: AppSession = {
                access_token: accessToken,
                refresh_token: refreshToken,
                user,
              }

              set({ session, user, loading: false })

              // Track user with analytics
              analytics.identify(user.id)
              analytics.setUser({
                email: user.email,
              })

              // Fetch coach profile
              get().fetchCoachProfile()
            } else if (response.status === 401) {
              // Token expired — try refreshing
              const refreshed = await get().refreshSession()
              if (refreshed) {
                // Retry /auth/me with new token
                const newAccessToken = getAccessToken()
                if (newAccessToken) {
                  const retryResponse = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: {
                      'Authorization': `Bearer ${newAccessToken}`,
                      'Content-Type': 'application/json',
                    },
                  })
                  if (retryResponse.ok) {
                    const backendUser = await retryResponse.json()
                    const user = mapUser(backendUser)
                    const refreshToken = getRefreshToken() || ''

                    set({
                      session: {
                        access_token: newAccessToken,
                        refresh_token: refreshToken,
                        user,
                      },
                      user,
                      loading: false,
                    })

                    analytics.identify(user.id)
                    analytics.setUser({ email: user.email })
                    get().fetchCoachProfile()
                    return
                  }
                }
              }

              // Refresh failed — clear everything
              clearTokens()
              set({ session: null, user: null, loading: false })
            } else {
              // Other error — clear tokens
              clearTokens()
              set({ session: null, user: null, loading: false })
            }
          })
          .catch(() => {
            clearTokens()
            set({ session: null, user: null, loading: false })
          })
      },
    }),
    { name: 'AuthStore' }
  )
)

// Export token helpers for use by API clients
export { getAccessToken, getRefreshToken, storeTokens, clearTokens }
