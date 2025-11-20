import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useAuthStore } from '@/stores/authStore'

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
  // Use the auth store instead of local state
  const session = useAuthStore(state => state.session)
  const user = useAuthStore(state => state.user)
  const loading = useAuthStore(state => state.loading)
  const signIn = useAuthStore(state => state.signIn)
  const signOut = useAuthStore(state => state.signOut)
  const sendPasswordResetEmail = useAuthStore(state => state.sendPasswordResetEmail)
  const updatePassword = useAuthStore(state => state.updatePassword)

  const value: AuthContextValue = {
    session,
    user,
    loading,
    signIn,
    signOut,
    sendPasswordResetEmail,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
