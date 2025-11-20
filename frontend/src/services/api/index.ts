// Central export file for all API services
export { swimmersApi } from './swimmers'
export { squadsApi } from './squads'
export { schedulesApi } from './schedules'
export { sessionsApi } from './sessions'
export { eventsApi } from './events'

// Re-export types
export type { Swimmer, CreateSwimmerData, UpdateSwimmerData, SwimmerSyncStatus } from '../swimmerService'
export type { Squad, SquadCard, CreateSquadData, UpdateSquadData } from '../squadService'
export type { TrainingSchedule, CreateScheduleData, UpdateScheduleData } from './schedules'
export type { TrainingSession, CreateSessionData, UpdateSessionData } from './sessions'
export type { CalendarEvent, CreateEventData, UpdateEventData } from './events'
