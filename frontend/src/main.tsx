import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import { StoreProvider } from './providers/StoreProvider'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'

// Configure React Query client with smart defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes - data stays "fresh" and won't auto-refetch
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes before garbage collection
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Only refetch on window focus if data is stale (>5 minutes old)
      refetchOnWindowFocus: true,
      // Don't refetch when component mounts if we have cached data
      refetchOnMount: false,
      // Refetch in background when data becomes stale
      refetchOnReconnect: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StoreProvider>
          <AuthProvider>
            <ToastProvider>
              <App />
              <ReactQueryDevtools initialIsOpen={false} />
            </ToastProvider>
          </AuthProvider>
        </StoreProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)