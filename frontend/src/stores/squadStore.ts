import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type Squad = {
  id: string
  name: string | null
  description: string | null
  created_at: string
}

export type SquadCard = Squad & {
  role: 'owner' | 'admin' | 'member'
  swimmers_count: number
}

export type SquadDetails = SquadCard & {
  schedules?: any[]
  sessions?: any[]
  events?: any[]
}

interface SquadState {
  // State
  squads: Map<string, SquadCard>
  squadDetails: Map<string, SquadDetails> // Extended data for squad detail pages
  loading: boolean
  error: string | null
  
  // Selected state
  selectedSquadId: string | null
  
  // Actions
  setSquads: (squads: SquadCard[]) => void
  addSquad: (squad: SquadCard) => void
  updateSquad: (id: string, updates: Partial<SquadCard>) => void
  removeSquad: (id: string) => void
  getSquad: (id: string) => SquadCard | undefined
  getAllSquads: () => SquadCard[]
  
  // Squad details actions
  setSquadDetails: (id: string, details: Partial<SquadDetails>) => void
  getSquadDetails: (id: string) => SquadDetails | undefined
  setSchedules: (squadId: string, schedules: any[]) => void
  setSessions: (squadId: string, sessions: any[]) => void
  setEvents: (squadId: string, events: any[]) => void
  
  // Granular session methods
  addSession: (squadId: string, session: any) => void
  updateSessionInStore: (squadId: string, sessionId: string, updates: any) => void
  removeSession: (squadId: string, sessionId: string) => void
  
  // Granular schedule methods
  addSchedule: (squadId: string, schedule: any) => void
  updateScheduleInStore: (squadId: string, scheduleId: string, updates: any) => void
  removeSchedule: (squadId: string, scheduleId: string) => void
  
  setSelectedSquad: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  squads: new Map<string, SquadCard>(),
  squadDetails: new Map<string, SquadDetails>(),
  loading: false,
  error: null,
  selectedSquadId: null,
}

export const useSquadStore = create<SquadState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setSquads: (squads) => {
        const squadsMap = new Map<string, SquadCard>()
        squads.forEach(squad => squadsMap.set(squad.id, squad))
        set({ squads: squadsMap })
      },

      addSquad: (squad) => {
        const squads = new Map(get().squads)
        squads.set(squad.id, squad)
        set({ squads })
      },

      updateSquad: (id, updates) => {
        const squads = new Map(get().squads)
        const squadDetails = new Map(get().squadDetails)
        const existing = squads.get(id)
        
        if (existing) {
          const updated = { ...existing, ...updates }
          squads.set(id, updated)
          
          // Also update in details if exists
          const existingDetails = squadDetails.get(id)
          if (existingDetails) {
            squadDetails.set(id, { ...existingDetails, ...updated })
          }
          
          set({ squads, squadDetails })
        }
      },

      removeSquad: (id) => {
        const squads = new Map(get().squads)
        const squadDetails = new Map(get().squadDetails)
        squads.delete(id)
        squadDetails.delete(id)
        set({ squads, squadDetails })
      },

      getSquad: (id) => get().squads.get(id),

      getAllSquads: () => Array.from(get().squads.values()),

      // Squad details methods
      setSquadDetails: (id, details) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(id) || get().squads.get(id)
        
        // Always set the squad details, creating a new entry if needed
        squadDetails.set(id, { ...existing, ...details } as SquadDetails)
        set({ squadDetails })
      },

      getSquadDetails: (id) => {
        return get().squadDetails.get(id) || get().squads.get(id)
      },

      setSchedules: (squadId, schedules) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        
        // Always set schedules, creating a minimal entry if needed
        squadDetails.set(squadId, { ...existing, schedules } as SquadDetails)
        set({ squadDetails })
      },

      setSessions: (squadId, sessions) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        
        // Always set sessions, creating a minimal entry if needed
        squadDetails.set(squadId, { ...existing, sessions } as SquadDetails)
        set({ squadDetails })
      },

      setEvents: (squadId, events) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        
        // Always set events, creating a minimal entry if needed
        squadDetails.set(squadId, { ...existing, events } as SquadDetails)
        set({ squadDetails })
      },

      // Granular session methods
      addSession: (squadId, session) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId) || { id: squadId } as SquadCard
        const existingDetails = squadDetails.get(squadId)
        const currentSessions = existingDetails?.sessions || []
        
        squadDetails.set(squadId, { 
          ...existing, 
          sessions: [...currentSessions, session] 
        } as SquadDetails)
        set({ squadDetails })
      },

      updateSessionInStore: (squadId, sessionId, updates) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        const existingDetails = squadDetails.get(squadId)
        const currentSessions = existingDetails?.sessions || []
        
        const updatedSessions = currentSessions.map((s: any) => 
          s.id === sessionId ? { ...s, ...updates } : s
        )
        
        squadDetails.set(squadId, { 
          ...existing, 
          sessions: updatedSessions 
        } as SquadDetails)
        set({ squadDetails })
      },

      removeSession: (squadId, sessionId) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        const existingDetails = squadDetails.get(squadId)
        const currentSessions = existingDetails?.sessions || []
        
        const filteredSessions = currentSessions.filter((s: any) => s.id !== sessionId)
        
        squadDetails.set(squadId, { 
          ...existing, 
          sessions: filteredSessions 
        } as SquadDetails)
        set({ squadDetails })
      },

      // Granular schedule methods
      addSchedule: (squadId, schedule) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        const existingDetails = squadDetails.get(squadId)
        const currentSchedules = existingDetails?.schedules || []
        
        squadDetails.set(squadId, { 
          ...existing, 
          schedules: [...currentSchedules, schedule] 
        } as SquadDetails)
        set({ squadDetails })
      },

      updateScheduleInStore: (squadId, scheduleId, updates) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        const existingDetails = squadDetails.get(squadId)
        const currentSchedules = existingDetails?.schedules || []
        
        const updatedSchedules = currentSchedules.map((s: any) => 
          s.id === scheduleId ? { ...s, ...updates } : s
        )
        
        squadDetails.set(squadId, { 
          ...existing, 
          schedules: updatedSchedules 
        } as SquadDetails)
        set({ squadDetails })
      },

      removeSchedule: (squadId, scheduleId) => {
        const squadDetails = new Map(get().squadDetails)
        const existing = squadDetails.get(squadId) || get().squads.get(squadId)
        const existingDetails = squadDetails.get(squadId)
        const currentSchedules = existingDetails?.schedules || []
        
        const filteredSchedules = currentSchedules.filter((s: any) => s.id !== scheduleId)
        
        squadDetails.set(squadId, { 
          ...existing, 
          schedules: filteredSchedules 
        } as SquadDetails)
        set({ squadDetails })
      },

      setSelectedSquad: (id) => set({ selectedSquadId: id }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      reset: () => set(initialState),
    }),
    { name: 'SquadStore' }
  )
)
