// styles/designTokens.ts
// Centralized design tokens for consistent styling across the app

/**
 * Background Gradients
 * Use these for consistent background styling
 */
export const GRADIENTS = {
  // Primary background gradient for pages
  BG_PRIMARY: 'bg-linear-to-br from-slate-950 via-slate-900 to-slate-950',
  
  // Secondary background gradient for elevated sections
  BG_ELEVATED: 'bg-linear-to-br from-slate-950/50 via-transparent to-slate-950/50',
  
  // Accent gradient for primary buttons and active states
  ACCENT: 'bg-linear-to-r from-cyan-500 to-blue-500',
  
  // Subtle glow effect for hover states
  GLOW_HOVER: 'bg-linear-to-br from-cyan-500/5 to-blue-500/5',
  
  // Text gradient for headings
  TEXT_ACCENT: 'bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent',
} as const;

/**
 * Border Styles
 * Consistent border colors and styles
 */
export const BORDERS = {
  DEFAULT: 'border-slate-700/50',
  HOVER: 'hover:border-cyan-500/30',
  ACTIVE: 'border-cyan-500/50',
  ELEVATED: 'border-slate-700',
} as const;

/**
 * Shadow Styles
 * Consistent shadow effects
 */
export const SHADOWS = {
  // Card shadows
  CARD: 'shadow-lg shadow-slate-900/50',
  CARD_HOVER: 'hover:shadow-xl hover:shadow-cyan-500/10',
  
  // Accent shadows
  ACCENT: 'shadow-lg shadow-cyan-500/30',
  
  // Glow effects
  GLOW_SM: 'drop-shadow-[0_0_8px_rgba(49,151,167,0.6)]',
  GLOW_MD: 'drop-shadow-[0_0_12px_rgba(49,151,167,0.5)]',
} as const;

/**
 * Card Styles
 * Reusable card component styles
 */
export const CARDS = {
  // Standard card background
  BASE: 'bg-slate-800/50 border border-slate-700/50 rounded-xl',
  
  // Interactive card with hover effect
  INTERACTIVE: 'bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200 cursor-pointer',
  
  // Elevated card
  ELEVATED: 'bg-slate-800 border border-slate-700 rounded-lg',
} as const;

/**
 * Button Styles
 * Consistent button appearances
 */
export const BUTTONS = {
  // Primary action button
  PRIMARY: 'bg-linear-to-r from-cyan-500 to-blue-500 hover:shadow-lg hover:shadow-cyan-500/30 text-white rounded-lg font-semibold transition-all duration-200',
  
  // Secondary button
  SECONDARY: 'bg-slate-800/50 border border-slate-600 text-slate-300 hover:text-white hover:border-cyan-500/30 rounded-lg font-medium transition-colors',
  
  // Ghost button
  GHOST: 'text-slate-400 hover:text-primary hover:bg-slate-800/50 rounded-lg transition-colors',
  
  // Danger button
  DANGER: 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg font-medium transition-colors',
} as const;

/**
 * Input Styles
 * Consistent form input styles
 */
export const INPUTS = {
  BASE: 'bg-slate-900/50 border border-slate-600 rounded-lg text-text-primary placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors',
} as const;

/**
 * Animation Durations
 * Consistent timing for transitions
 */
export const TRANSITIONS = {
  FAST: 'transition-all duration-150',
  DEFAULT: 'transition-all duration-200',
  SLOW: 'transition-all duration-300',
} as const;

/**
 * Spacing
 * Consistent padding and margins
 */
export const SPACING = {
  SECTION: 'py-6 sm:py-8',
  CARD_PADDING: 'p-4',
  CARD_PADDING_LG: 'p-6',
  CONTAINER: 'px-4 sm:px-6 lg:px-8',
} as const;

/**
 * Helper function to combine design tokens
 * Usage: cn(CARDS.BASE, SHADOWS.CARD_HOVER)
 */
export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
