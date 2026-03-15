import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Calendar, Clock, Users, CheckCircle2, Dumbbell } from 'lucide-react'
import { apiClient } from '@/lib/apiClient'
import { TrainingSession } from '@/services/sessionService'
import { WorkoutTemplate } from '@/services/workoutTemplateService'
import { assignWorkoutToSession } from '@/services/workoutTemplateService'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { format, parseISO } from 'date-fns'

interface Squad {
  id: string
  name: string
}

interface SessionWithSquad extends TrainingSession {
  squad_name?: string
}

interface AssignWorkoutToSessionModalProps {
  workout: WorkoutTemplate
  isOpen: boolean
  onClose: () => void
  onAssigned?: () => void
  preSelectedSquadId?: string
}

export const AssignWorkoutToSessionModal: React.FC<AssignWorkoutToSessionModalProps> = ({
  workout,
  isOpen,
  onClose,
  onAssigned,
  preSelectedSquadId,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  // Fetch coach's squads
  const { data: squads = [] } = useQuery({
    queryKey: ['coach-squads', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const data = await apiClient.get<any[]>('/squads')

      return (data || []).map((s: any) => ({ id: s.id, name: s.name })) as Squad[]
    },
    enabled: !!user?.id && isOpen,
  })

  // Fetch unassigned sessions for coach's squads
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['unassigned-sessions', user?.id, squads.map(s => s.id)],
    queryFn: async () => {
      if (!user?.id || squads.length === 0) return []

      // Fetch sessions for all squads
      const allSessions = await Promise.all(
        squads.map(s => apiClient.get<any[]>(`/squads/${s.id}/sessions`))
      )

      // Flatten and filter to unassigned sessions only
      const sessionsWithSquads: SessionWithSquad[] = allSessions
        .flat()
        .filter(session => !session.workout_id)
        .map(session => ({
          ...session,
          squad_name: squads.find(s => s.id === session.squad_id)?.name,
        }))
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

      return sessionsWithSquads
    },
    enabled: !!user?.id && squads.length > 0 && isOpen,
  })

  // Filter sessions by pre-selected squad if provided
  const filteredSessions = preSelectedSquadId
    ? sessions.filter(s => s.squad_id === preSelectedSquadId)
    : sessions

  // Group sessions by squad
  const sessionsBySquad = filteredSessions.reduce((acc, session) => {
    const squadId = session.squad_id
    if (!acc[squadId]) {
      acc[squadId] = []
    }
    acc[squadId].push(session)
    return acc
  }, {} as Record<string, SessionWithSquad[]>)

  const handleAssign = async () => {
    if (!selectedSessionId) return

    setIsAssigning(true)
    try {
      await assignWorkoutToSession(workout.id, selectedSessionId)
      
      showToast('Workout assigned successfully!', 'success')
      
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

  const formatSessionTime = (session: TrainingSession) => {
    try {
      const start = parseISO(session.start_date)
      const end = parseISO(session.end_date)
      return `${format(start, 'MMM d, yyyy')} • ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`
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
            <h2 className="text-xl font-bold text-slate-100">Assign Workout to Session</h2>
            <p className="text-sm text-slate-400 mt-1">
              Select a training session for "{workout.name}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Workout Preview */}
        <div className="px-6 py-4 bg-slate-800/30 border-b border-slate-700/30">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <Dumbbell size={24} className="text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-100">{workout.name}</h3>
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">{workout.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span>{workout.total_meters}m</span>
                <span>•</span>
                <span>{workout.estimated_time_minutes} min</span>
                <span>•</span>
                <span>Effort: {workout.effort_level}/10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={48} className="text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">No unassigned sessions found</p>
              <p className="text-sm text-slate-500 mt-1">
                All sessions already have workouts assigned
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(sessionsBySquad).map(([squadId, squadSessions]) => {
                const squad = squads.find(s => s.id === squadId)
                return (
                  <div key={squadId}>
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={16} className="text-slate-400" />
                      <h3 className="font-semibold text-slate-300">{squad?.name}</h3>
                      <span className="text-xs text-slate-500">
                        ({squadSessions.length} {squadSessions.length === 1 ? 'session' : 'sessions'})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {squadSessions.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`w-full text-left p-4 rounded-lg border transition-all ${
                            selectedSessionId === session.id
                              ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                              : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60 hover:border-slate-600/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar size={14} className="text-slate-400" />
                                <span className="text-sm font-medium text-slate-200">
                                  {formatSessionTime(session)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="px-2 py-0.5 bg-slate-700/50 rounded">
                                  {session.training_type}
                                </span>
                              </div>
                            </div>
                            {selectedSessionId === session.id && (
                              <CheckCircle2 size={20} className="text-cyan-400 shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
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
            disabled={!selectedSessionId || isAssigning}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed"
          >
            {isAssigning ? 'Assigning...' : 'Assign Workout'}
          </button>
        </div>
      </div>
    </div>
  )
}
