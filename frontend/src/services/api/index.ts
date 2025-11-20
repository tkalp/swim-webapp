// Central export file for all API services
export { swimmersApi } from '@/services/api/swimmers'
export { squadsApi } from '@/services/api/squads'
export { schedulesApi } from '@/services/api/schedules'
export { sessionsApi } from '@/services/api/sessions'
export { eventsApi } from '@/services/api/events'

// Re-export types
export type { Swimmer, CreateSwimmerData, UpdateSwimmerData, SwimmerSyncStatus } from '../swimmerService'
export type { Squad, SquadCard, CreateSquadData, UpdateSquadData } from '../squadService'
export type { TrainingSchedule, CreateScheduleData, UpdateScheduleData } from '@/services/api/schedules'
export type { TrainingSession, CreateSessionData, UpdateSessionData } from '@/services/api/sessions'
export type { CalendarEvent, CreateEventData, UpdateEventData } from '@/services/api/events'
