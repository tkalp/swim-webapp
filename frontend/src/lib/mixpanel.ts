import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
const isEnabled = Boolean(MIXPANEL_TOKEN);

if (isEnabled) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV,
    track_pageview: true,
    persistence: 'localStorage',
    record_sessions_percent: 100, // Record 100% of sessions
    record_block_selector: '[data-private]', // Block elements with data-private attribute
    record_mask_text_selector: '[data-mask]', // Mask text in elements with data-mask attribute
  });
} else {
  console.warn('Mixpanel token not found. Analytics will be disabled.');
}

// Helper functions for tracking
export const analytics = {
  // Identify user
  identify: (userId: string) => {
    if (!isEnabled) return;
    mixpanel.identify(userId);
  },

  // Set user properties
  setUser: (properties: Record<string, any>) => {
    if (!isEnabled) return;
    mixpanel.people.set(properties);
  },

  // Track events
  track: (eventName: string, properties?: Record<string, any>) => {
    if (!isEnabled) return;
    mixpanel.track(eventName, properties);
  },

  // Track page views
  trackPageView: (pageName: string, properties?: Record<string, any>) => {
    if (!isEnabled) return;
    mixpanel.track('Page View', {
      page: pageName,
      ...properties,
    });
  },

  // Reset on logout
  reset: () => {
    if (!isEnabled) return;
    mixpanel.reset();
  },

  // Time events
  timeEvent: (eventName: string) => {
    if (!isEnabled) return;
    mixpanel.time_event(eventName);
  },

  // Register super properties (sent with every event)
  registerSuperProperties: (properties: Record<string, any>) => {
    if (!isEnabled) return;
    mixpanel.register(properties);
  },

  // Track link clicks
  trackLink: (element: HTMLElement, eventName: string, properties?: Record<string, any>) => {
    if (!isEnabled) return;
    mixpanel.track_links(element, eventName, properties);
  },
};

export default analytics;
