import '@testing-library/jest-dom'
import { expect, afterEach, vi, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock apiClient
const mockApiClient = {
  get: vi.fn().mockResolvedValue(null),
  post: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(null),
}

const mockAuthenticatedFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
const mockGetAccessToken = vi.fn().mockReturnValue('mock-token')

vi.mock('../lib/apiClient', () => ({
  apiClient: mockApiClient,
  authenticatedFetch: mockAuthenticatedFetch,
  getAccessToken: mockGetAccessToken,
}))

// Mock Mixpanel
const mockMixpanel = {
  track: vi.fn(),
  identify: vi.fn(),
  people: {
    set: vi.fn(),
  },
  register: vi.fn(),
  reset: vi.fn(),
}

vi.mock('../lib/mixpanel', () => ({
  analytics: mockMixpanel,
}))

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  }
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as any

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any

// Export mocks for use in tests
export { mockApiClient, mockAuthenticatedFetch, mockMixpanel }
