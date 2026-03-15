import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Search, Dumbbell, Activity, Clock, Flame, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { WorkoutTemplate } from '@/services/workoutTemplateService'
import { assignWorkoutToSession } from '@/services/workoutTemplateService'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { format, parseISO } from 'date-fns'
import { TrainingSession } from '@/services/sessionService'
import { Session } from '../squad/SessionsList'

interface SelectWorkoutToAssignModalProps {
  squadId: string
  session?: Session
  isOpen: boolean
  onClose: () => void
  onAssigned?: () => void
}

export const SelectWorkoutToAssignModal: React.FC<SelectWorkoutToAssignModalProps> = ({
  squadId,
  session,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch unassigned sessions for the squad
  const { data: sessions = [] } = useQuery({
    queryKey: ['unassigned-sessions', squadId],
    queryFn: async () => {
      const data = await apiClient.get<any[]>(`/squads/${squadId}/sessions`)
      // Filter to unassigned sessions only
      return (data || []).filter((s: any) => !s.workout_id).sort(
        (a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ) as TrainingSession[]
    },
    enabled: !!squadId && isOpen && !session,
  })

  // Fetch coach's workouts
  const { data: workouts = [], isLoading } = useQuery({
    queryKey: ['coach-workouts', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const result = await apiClient.get<any>(`/workouts/coach/${user.id}`)
      return (result?.workouts || result || []) as WorkoutTemplate[]
    },
    enabled: !!user?.id && isOpen,
  })

  // Filter workouts by search
  const filteredWorkouts = workouts.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const targetSessions = session ? [session] : sessions

  const handleAssign = async () => {
    if (!selectedWorkoutId || targetSessions.length === 0) return

    setIsAssigning(true)
    try {
      // Assign to all target sessions
      await Promise.all(
        targetSessions.map(s => assignWorkoutToSession(selectedWorkoutId, s.id))
      )
      
      const sessionCount = targetSessions.length
      showToast(
        sessionCount === 1
          ? 'Workout assigned successfully!'
          : `Workout assigned to ${sessionCount} sessions!`,
        'success'
      )
      
      if (onAssigned) {
        onAssigned()
      }
      
      onClose()
    } catch (error) {
      console.error('Error assigning workout:', error)
      showToast('Failed to assign workout', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  const formatSessionTime = (session: Session) => {
    try {
      const start = parseISO(session.start_date)
      return format(start, 'MMM d, yyyy • h:mm a')
    } catch (error) {
      return session.start_date
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Select Workout to Assign</h2>
            <p className="text-sm text-slate-400 mt-1">
              {session
                ? `Assign a workout to session on ${formatSessionTime(session)}`
                : `Choose a workout for ${targetSessions.length} unassigned session${targetSessions.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-slate-700/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search workouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/40 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Workouts List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : filteredWorkouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Dumbbell size={48} className="text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">
                {searchQuery ? 'No workouts match your search' : 'No workouts found'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Create a workout first to assign it to sessions
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredWorkouts.map((workout) => (
                <button
                  key={workout.id}
                  onClick={() => setSelectedWorkoutId(workout.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedWorkoutId === workout.id
                      ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60 hover:border-slate-600/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                          <Dumbbell size={18} className="text-cyan-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-100">{workout.name}</h3>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {workout.description}
                          </p>
                        </div>
                        {selectedWorkoutId === workout.id && (
                          <CheckCircle2 size={24} className="text-cyan-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                        <div className="flex items-center gap-1">
                          <Activity size={12} />
                          <span>{workout.total_meters}m</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>{workout.estimated_time_minutes} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flame size={12} />
                          <span>{workout.estimated_calories} cal</span>
                        </div>
                        <div className="px-2 py-0.5 bg-slate-700/50 rounded">
                          Level {workout.effort_level}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 bg-slate-800/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedWorkoutId || isAssigning || targetSessions.length === 0}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed"
          >
            {isAssigning
              ? 'Assigning...'
              : `Assign to ${targetSessions.length} Session${targetSessions.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
