// lib/apiClient.ts
import { supabase } from '@/lib/supabase'

/**
 * Get authorization headers for API requests
 * Includes the JWT token from Supabase auth
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  return headers
}

/**
 * Authenticated fetch wrapper that automatically includes auth headers
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeaders()
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders, // Auth headers last to ensure Authorization is not overridden
    },
  })
  
  // Handle 401 Unauthorized - token might be expired
  if (response.status === 401) {
    // Try to refresh the session
    const { error } = await supabase.auth.refreshSession()
    
    if (error) {
      // Redirect to login if refresh fails
      window.location.href = '/login'
      throw new Error('Session expired. Please log in again.')
    }
    
    // Retry the request with new token
    const newHeaders = await getAuthHeaders()
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...newHeaders, // Auth headers last to ensure Authorization is not overridden
      },
    })
  }
  
  return response
}
