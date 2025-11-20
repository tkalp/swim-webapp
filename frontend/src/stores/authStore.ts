import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { analytics } from '../lib/mixpanel'

interface AuthState {
  // State
  session: Session | null
  user: User | null
  loading: boolean
  
  // Actions
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
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

      // Actions
      setSession: (session) => set({ 
        session, 
        user: session?.user ?? null 
      }),

      setLoading: (loading) => set({ loading }),

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
        set({ session: null, user: null })
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
          } else {
            analytics.reset()
          }
        })
      },
    }),
    { name: 'AuthStore' }
  )
)
