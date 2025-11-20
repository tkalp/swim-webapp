import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Swimmer } from '@/services/swimmerService'

interface SwimmerState {
  // State
  swimmers: Map<string, Swimmer>
  swimmersBySquad: Map<string, string[]> // squadId -> swimmerId[]
  loading: boolean
  error: string | null
  
  // Selected state
  selectedSwimmerId: string | null
  
  // Actions
  setSwimmers: (swimmers: Swimmer[], squadId?: string) => void
  addSwimmer: (swimmer: Swimmer) => void
  updateSwimmer: (id: string, updates: Partial<Swimmer>) => void
  removeSwimmer: (id: string) => void
  getSwimmer: (id: string) => Swimmer | undefined
  getSwimmersBySquad: (squadId: string) => Swimmer[]
  setSelectedSwimmer: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  swimmers: new Map<string, Swimmer>(),
  swimmersBySquad: new Map<string, string[]>(),
  loading: false,
  error: null,
  selectedSwimmerId: null,
}

export const useSwimmerStore = create<SwimmerState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setSwimmers: (swimmers, squadId) => {
        const swimmersMap = new Map<string, Swimmer>()
        const bySquad = new Map<string, string[]>(get().swimmersBySquad)
        
        swimmers.forEach(swimmer => {
          swimmersMap.set(swimmer.id, swimmer)
          
          // Group by squad - use provided squadId or swimmer's squad_id
          const effectiveSquadId = squadId || swimmer.squad_id
          if (effectiveSquadId) {
            const squadSwimmers = bySquad.get(effectiveSquadId) || []
            if (!squadSwimmers.includes(swimmer.id)) {
              squadSwimmers.push(swimmer.id)
            }
            bySquad.set(effectiveSquadId, squadSwimmers)
          }
        })
        
        // Merge with existing swimmers instead of replacing
        const existingSwimmers = new Map(get().swimmers)
        swimmersMap.forEach((swimmer, id) => {
          existingSwimmers.set(id, swimmer)
        })
        
        set({ swimmers: existingSwimmers, swimmersBySquad: bySquad })
      },

      addSwimmer: (swimmer) => {
        const swimmers = new Map(get().swimmers)
        swimmers.set(swimmer.id, swimmer)
        
        const bySquad = new Map(get().swimmersBySquad)
        if (swimmer.squad_id) {
          const squadSwimmers = bySquad.get(swimmer.squad_id) || []
          if (!squadSwimmers.includes(swimmer.id)) {
            squadSwimmers.push(swimmer.id)
            bySquad.set(swimmer.squad_id, squadSwimmers)
          }
        }
        
        set({ swimmers, swimmersBySquad: bySquad })
      },

      updateSwimmer: (id, updates) => {
        const swimmers = new Map(get().swimmers)
        const existing = swimmers.get(id)
        
        if (existing) {
          const updated = { ...existing, ...updates }
          swimmers.set(id, updated)
          
          // Handle squad changes
          if (updates.squad_id !== undefined && updates.squad_id !== existing.squad_id) {
            const bySquad = new Map(get().swimmersBySquad)
            
            // Remove from old squad
            if (existing.squad_id) {
              const oldSquadSwimmers = bySquad.get(existing.squad_id) || []
              bySquad.set(
                existing.squad_id,
                oldSquadSwimmers.filter(swimmerId => swimmerId !== id)
              )
            }
            
            // Add to new squad
            if (updates.squad_id) {
              const newSquadSwimmers = bySquad.get(updates.squad_id) || []
              if (!newSquadSwimmers.includes(id)) {
                newSquadSwimmers.push(id)
                bySquad.set(updates.squad_id, newSquadSwimmers)
              }
            }
            
            set({ swimmers, swimmersBySquad: bySquad })
          } else {
            set({ swimmers })
          }
        }
      },

      removeSwimmer: (id) => {
        const swimmers = new Map(get().swimmers)
        const swimmer = swimmers.get(id)
        
        if (swimmer) {
          swimmers.delete(id)
          
          // Remove from squad index
          if (swimmer.squad_id) {
            const bySquad = new Map(get().swimmersBySquad)
            const squadSwimmers = bySquad.get(swimmer.squad_id) || []
            bySquad.set(
              swimmer.squad_id,
              squadSwimmers.filter(swimmerId => swimmerId !== id)
            )
            set({ swimmers, swimmersBySquad: bySquad })
          } else {
            set({ swimmers })
          }
        }
      },

      getSwimmer: (id) => get().swimmers.get(id),

      getSwimmersBySquad: (squadId) => {
        const swimmerIds = get().swimmersBySquad.get(squadId) || []
        return swimmerIds
          .map(id => get().swimmers.get(id))
          .filter((swimmer): swimmer is Swimmer => swimmer !== undefined)
      },

      setSelectedSwimmer: (id) => set({ selectedSwimmerId: id }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      reset: () => set(initialState),
    }),
    { name: 'SwimmerStore' }
  )
)
