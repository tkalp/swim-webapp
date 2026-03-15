// lib/apiClient.ts
import { getAccessToken, useAuthStore } from '@/stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Get authorization headers for API requests.
 * Reads the access token from localStorage.
 */
export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  const accessToken = getAccessToken()
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  return headers
}

/**
 * Delegate token refresh to authStore so there is a single refresh path
 * with no race condition between the store and the API client.
 */
async function tryRefreshToken(): Promise<boolean> {
  return useAuthStore.getState().refreshSession()
}

/**
 * Authenticated fetch wrapper that automatically includes auth headers
 * and handles 401 with token refresh.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = getAuthHeaders()

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders,
    },
  })

  // Handle 401 Unauthorized - token might be expired
  if (response.status === 401) {
    const refreshed = await tryRefreshToken()

    if (!refreshed) {
      // Tokens are cleared by refreshSession — ProtectedRoute will redirect on next render
      throw new Error('Session expired. Please log in again.')
    }

    // Retry the request with new token
    const newHeaders = getAuthHeaders()
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...newHeaders,
      },
    })
  }

  return response
}

/**
 * API client with common HTTP methods
 */
export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const url = `${API_BASE_URL}${path}`
    const response = await authenticatedFetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  },

  async post<T>(path: string, data?: any): Promise<T> {
    const url = `${API_BASE_URL}${path}`
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  },

  async put<T>(path: string, data?: any): Promise<T> {
    const url = `${API_BASE_URL}${path}`
    const response = await authenticatedFetch(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  },

  async delete<T>(path: string): Promise<T> {
    const url = `${API_BASE_URL}${path}`
    const response = await authenticatedFetch(url, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  },
}
