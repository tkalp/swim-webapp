// Centralized API configuration

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Use the configured API URL directly
// In Docker: VITE_API_URL=/api (nginx proxies /api/* to backend)
// In development: VITE_API_URL=http://localhost:8000 (direct backend access)
export const API_BASE_URL = rawApiUrl;

// Helper function to build full API URLs
export const getApiUrl = (path: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};
