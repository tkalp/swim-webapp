import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

mixpanel.init(MIXPANEL_TOKEN, {
  debug: import.meta.env.DEV,
  track_pageview: true,
  persistence: 'localStorage',
});

// Helper functions for tracking
export const analytics = {
  // Identify user
  identify: (userId: string) => {
    mixpanel.identify(userId);
  },

  // Set user properties
  setUser: (properties: Record<string, any>) => {
    mixpanel.people.set(properties);
  },

  // Track events
  track: (eventName: string, properties?: Record<string, any>) => {
    mixpanel.track(eventName, properties);
  },

  // Track page views
  trackPageView: (pageName: string, properties?: Record<string, any>) => {
    mixpanel.track('Page View', {
      page: pageName,
      ...properties,
    });
  },

  // Reset on logout
  reset: () => {
    mixpanel.reset();
  },

  // Time events
  timeEvent: (eventName: string) => {
    mixpanel.time_event(eventName);
  },

  // Register super properties (sent with every event)
  registerSuperProperties: (properties: Record<string, any>) => {
    mixpanel.register(properties);
  },

  // Track link clicks
  trackLink: (element: HTMLElement, eventName: string, properties?: Record<string, any>) => {
    mixpanel.track_links(element, eventName, properties);
  },
};

export default mixpanel;
