import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - inject auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Get current session from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch (error) {
      console.error('Failed to get auth session:', error)
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors consistently
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error: AxiosError) => {
    // Handle network errors
    if (!error.response) {
      throw new ApiError(
        'Network error. Please check your connection.',
        undefined,
        'NETWORK_ERROR'
      )
    }

    const { status, data } = error.response

    // Handle authentication errors
    if (status === 401) {
      // Clear session and redirect to login
      await supabase.auth.signOut()
      window.location.href = '/login'
      throw new ApiError(
        'Session expired. Please log in again.',
        401,
        'UNAUTHORIZED'
      )
    }

    // Handle forbidden errors
    if (status === 403) {
      throw new ApiError(
        'You do not have permission to perform this action.',
        403,
        'FORBIDDEN',
        data
      )
    }

    // Handle not found errors
    if (status === 404) {
      throw new ApiError(
        'Resource not found.',
        404,
        'NOT_FOUND',
        data
      )
    }

    // Handle validation errors
    if (status === 422) {
      const errorMessage = (data as any)?.detail || 'Validation error'
      throw new ApiError(
        errorMessage,
        422,
        'VALIDATION_ERROR',
        data
      )
    }

    // Handle server errors
    if (status >= 500) {
      throw new ApiError(
        'Server error. Please try again later.',
        status,
        'SERVER_ERROR',
        data
      )
    }

    // Handle other errors
    const errorMessage = (data as any)?.detail || (data as any)?.message || 'An error occurred'
    throw new ApiError(
      errorMessage,
      status,
      'API_ERROR',
      data
    )
  }
)

export default apiClient
