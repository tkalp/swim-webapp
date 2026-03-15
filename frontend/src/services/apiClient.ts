import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { API_BASE_URL } from '@/lib/api'
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from '@/stores/authStore'

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

// Request interceptor - inject auth token from localStorage
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const accessToken = getAccessToken()

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
    } catch (error) {
      console.error('Failed to get auth token:', error)
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Flag to prevent multiple concurrent refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: any) => void
  reject: (reason?: any) => void
}> = []

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve(token)
    }
  })
  failedQueue = []
}

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
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Handle authentication errors with token refresh
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while a refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = getRefreshToken()

      if (!refreshToken) {
        isRefreshing = false
        processQueue(new Error('No refresh token'), null)
        clearTokens()
        window.location.href = '/login'
        throw new ApiError(
          'Session expired. Please log in again.',
          401,
          'UNAUTHORIZED'
        )
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })

        const { access_token, refresh_token: newRefreshToken } = response.data
        storeTokens(access_token, newRefreshToken)

        isRefreshing = false
        processQueue(null, access_token)

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        isRefreshing = false
        processQueue(refreshError, null)
        clearTokens()
        window.location.href = '/login'
        throw new ApiError(
          'Session expired. Please log in again.',
          401,
          'UNAUTHORIZED'
        )
      }
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
