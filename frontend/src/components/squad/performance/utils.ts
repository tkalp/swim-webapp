/**
 * Utility functions for squad performance analytics
 */

/**
 * Format event key to readable name with course type
 * Event key format: "{distance}{units}_{stroke}_{activity}_{result_units}_{equipment}"
 * Example: "100M_freestyle_swim_SCM" or "200M_butterfly_swim_LCM_fins"
 */
export const formatEventName = (eventKey: string): string => {
  const parts = eventKey.split('_');
  const distance = parts[0]; // e.g., "100M"
  let stroke = parts[1]?.charAt(0).toUpperCase() + parts[1]?.slice(1) || ''; // e.g., "Freestyle"
  
  // Special case for IM - make it all caps
  if (parts[1]?.toLowerCase() === 'im') {
    stroke = 'IM';
  }
  
  const courseType = parts[3] || 'SCM'; // e.g., "SCM" or "LCM"
  const equipment = parts[4] ? ` (${parts[4]})` : ''; // e.g., " (fins)"
  
  return `${distance} ${stroke} (${courseType})${equipment}`;
};

/**
 * Get CSS classes for activity badge styling
 */
export const getActivityBadgeStyles = (activity?: string): string => {
  const act = (activity ?? '').toLowerCase();
  
  switch (act) {
    case 'kick':
      return 'bg-gradient-to-br from-warning/20 to-warning/10 border border-warning/40 text-warning';
    case 'pull':
      return 'bg-gradient-to-br from-success/20 to-success/10 border border-success/40 text-success';
    default:
      return 'bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/40 text-primary';
  }
};

/**
 * Format activity label for display
 */
export const formatActivity = (activity?: string): string => {
  const act = (activity ?? '').toLowerCase();
  
  switch (act) {
    case 'kick':
      return 'Kick';
    case 'pull':
      return 'Pull';
    default:
      return 'Swim';
  }
};

/**
 * Get default date range (Sept 1 of current year to today)
 */
export const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date(endDate.getFullYear(), 8, 1); // Sept 1 (month is 0-indexed)
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
};

/**
 * Get swimmer initials from full name
 */
export const getSwimmerInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};
