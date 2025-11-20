// Re-export all stores for easy importing
export { useAuthStore } from '@/stores/authStore'
export { useSwimmerStore } from '@/stores/swimmerStore'
export { useSquadStore } from '@/stores/squadStore'
export { useUIStore } from '@/stores/uiStore'

// Re-export types
export type { Squad, SquadCard, SquadDetails } from '@/stores/squadStore'
