import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { analytics } from '@/lib/mixpanel'

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
  session: Session | null
  user: User | null
  loading: boolean
  coachProfile: CoachProfile | null
  coachLoading: boolean
  
  // Actions
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setCoachProfile: (profile: CoachProfile | null) => void
  fetchCoachProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error?: Error }>
  signOut: () => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<{ error?: Error }>
  updatePassword: (newPassword: string) => Promise<{ error?: Error }>
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
        user: session?.user ?? null 
      }),

      setLoading: (loading) => set({ loading }),

      setCoachProfile: (profile) => set({ coachProfile: profile }),

      fetchCoachProfile: async () => {
        const { session } = get()
        if (!session) {
          set({ coachProfile: null, coachLoading: false })
          return
        }

        try {
          set({ coachLoading: true })
          const response = await fetch(`${import.meta.env.VITE_API_URL}/coaches/me`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
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
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (!error) {
          analytics.track('User Signed In', { method: 'email' })
        }
        return error ? { error } : {}
      },

      signOut: async () => {
        analytics.track('User Signed Out')
        analytics.reset()
        await supabase.auth.signOut()
        set({ session: null, user: null, coachProfile: null })
      },

      sendPasswordResetEmail: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        return error ? { error } : {}
      },

      updatePassword: async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        return error ? { error } : {}
      },

      initialize: () => {
        // Get initial session
        supabase.auth.getSession().then(({ data }) => {
          set({ session: data.session ?? null, loading: false })
          
          // Fetch coach profile if session exists
          if (data.session) {
            get().fetchCoachProfile()
          }
        })

        // Subscribe to auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
          set({ session: session ?? null, user: session?.user ?? null })
          
          // Track user authentication with Mixpanel
          if (session?.user) {
            analytics.identify(session.user.id)
            analytics.setUser({
              email: session.user.email,
              created_at: session.user.created_at,
            })
            
            // Fetch coach profile on sign in
            get().fetchCoachProfile()
          } else {
            analytics.reset()
            set({ coachProfile: null })
          }
        })
      },
    }),
    { name: 'AuthStore' }
  )
)
