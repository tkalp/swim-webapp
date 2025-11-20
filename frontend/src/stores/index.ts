// Re-export all stores for easy importing
export { useAuthStore } from './authStore'
export { useSwimmerStore } from './swimmerStore'
export { useSquadStore } from './squadStore'
export { useUIStore } from './uiStore'

// Re-export types
export type { Squad, SquadCard, SquadDetails } from './squadStore'
