// Centralized API configuration

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// If using localhost, don't prefix with /api (nginx strips it in production)
// If using production domain, include /api prefix
const isLocalhost = rawApiUrl.includes('localhost:5173') || rawApiUrl.includes('127.0.0.1');

export const API_BASE_URL = isLocalhost ? rawApiUrl : `${rawApiUrl}/api`;

// Helper function to build full API URLs
export const getApiUrl = (path: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};
