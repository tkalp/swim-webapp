import { useCallback } from 'react';
import { analytics } from '../lib/mixpanel';

/**
 * Custom hook for Mixpanel analytics tracking
 * Provides convenient methods for tracking events throughout the app
 */
export function useAnalytics() {
  const track = useCallback((eventName: string, properties?: Record<string, any>) => {
    analytics.track(eventName, properties);
  }, []);

  const trackPageView = useCallback((pageName: string, properties?: Record<string, any>) => {
    analytics.trackPageView(pageName, properties);
  }, []);

  const timeEvent = useCallback((eventName: string) => {
    analytics.timeEvent(eventName);
  }, []);

  return {
    track,
    trackPageView,
    timeEvent,
  };
}
