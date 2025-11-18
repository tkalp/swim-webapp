import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { analytics } from '../lib/mixpanel'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: Error }>
  signOut: () => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<{ error?: Error }>
  updatePassword: (newPassword: string) => Promise<{ error?: Error }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // initial load
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    // subscribe to changes
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null)
      
      // Track user authentication with Mixpanel
      if (s?.user) {
        console.log("User Email: " + s?.user.email)
        analytics.identify(s.user.id)
        analytics.setUser({
          email: s.user.email,
          created_at: s.user.created_at,
        })
      } else {
        analytics.reset()
      }
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) {
        analytics.track('User Signed In', { method: 'email' })
      }
      return error ? { error } : {}
    },
    async signOut() {
      analytics.track('User Signed Out')
      analytics.reset()
      await supabase.auth.signOut()
    },
    async sendPasswordResetEmail(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      return error ? { error } : {}
    },
    async updatePassword(newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      return error ? { error } : {}
    }
  }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
