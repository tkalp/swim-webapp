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

// ============================================
// NEW METRICS UTILITIES
// ============================================

/**
 * Format consistency score (0-100) for display
 */
export const formatConsistencyScore = (score?: number): string => {
  if (score === undefined || score === null) return '—';
  return `${Math.round(score)}/100`;
};

/**
 * Get color class for consistency score
 * High consistency = green, moderate = blue, low = orange
 */
export const getConsistencyColor = (score?: number): string => {
  if (score === undefined || score === null) return 'text-slate-400';
  if (score >= 90) return 'text-emerald-400';
  if (score >= 70) return 'text-blue-400';
  return 'text-orange-400';
};

/**
 * Get background color class for consistency score badge
 */
export const getConsistencyBgColor = (score?: number): string => {
  if (score === undefined || score === null) return 'bg-slate-500/20';
  if (score >= 90) return 'bg-emerald-500/20 border-emerald-500/40';
  if (score >= 70) return 'bg-blue-500/20 border-blue-500/40';
  return 'bg-orange-500/20 border-orange-500/40';
};

/**
 * Format weighted improvement percentage
 * Caps display at ±50% to prevent extreme values from dominating UI
 */
export const formatWeightedImprovement = (percentage?: number): string => {
  if (percentage === undefined || percentage === null) return '—';
  
  // Cap display at ±50% for visual clarity
  if (percentage < -50) return '−50%+';
  if (percentage > 50) return '+50%+';
  
  return `${percentage < 0 ? '−' : '+'}${Math.abs(percentage).toFixed(1)}%`;
};

/**
 * Get color for weighted improvement
 * Negative = improving (green), positive = regressing (red)
 * Extreme values get brighter colors to emphasize magnitude
 */
export const getWeightedImprovementColor = (percentage?: number): string => {
  if (percentage === undefined || percentage === null) return 'text-slate-400';
  
  const abs = Math.abs(percentage);
  
  if (percentage < 0) {
    // Improving (negative = faster)
    if (abs > 30) return 'text-emerald-400'; // Significant improvement
    if (abs > 10) return 'text-green-400';   // Good improvement
    return 'text-green-500';                  // Minor improvement
  } else {
    // Regressing (positive = slower)
    if (abs > 30) return 'text-red-400';     // Significant regression
    if (abs > 10) return 'text-orange-400';  // Moderate regression
    return 'text-yellow-500';                 // Minor regression
  }
};

/**
 * Format trend velocity for display
 */
export const formatTrendVelocity = (velocity?: number): { icon: string; label: string; color: string } => {
  if (velocity === undefined || velocity === null) {
    return { icon: '—', label: 'No trend', color: 'text-slate-400' };
  }
  
  const absVelocity = Math.abs(velocity);
  if (absVelocity < 0.001) {
    return { icon: '→', label: 'Stable', color: 'text-slate-400' };
  }
  if (velocity < 0) {
    return { icon: '↓', label: 'Improving', color: 'text-green-400' };
  }
  return { icon: '↑', label: 'Declining', color: 'text-red-400' };
};

/**
 * Get tooltip text for new metrics
 */
export const getMetricTooltip = (metricType: 'consistency' | 'weighted' | 'trend'): string => {
  switch (metricType) {
    case 'consistency':
      return 'Consistency Score: How uniformly a swimmer improves across all events (0-100). Higher = more balanced development.';
    case 'weighted':
      return 'Weighted Improvement: Recent attempts weighted more heavily than historical baseline. Shows current form.';
    case 'trend':
      return 'Trend Velocity: Rate of improvement over time. ↓ = improving, → = stable, ↑ = declining.';
  }
};

