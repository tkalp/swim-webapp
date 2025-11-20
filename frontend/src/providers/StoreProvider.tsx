import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

/**
 * Provider component that initializes the auth store.
 * Should be rendered once at the app root.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore(state => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return <>{children}</>
}
