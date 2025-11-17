import { useState, useMemo } from 'react'
import { Calendar, Clock, Plus, Edit, Trash2, MapPin, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ScheduleFormModal from './ScheduleFormModal'
import { SquadPageHeader } from './SquadPageHeader'

type TrainingSchedule = {
  id: string
  squad_id: string
  day_of_week: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  start_time: string
  end_time: string
  training_type: 'Swim' | 'Dryland'
  active: boolean
  until: string | null
  created_at: string
}

type WeeklyScheduleViewProps = {
  squadId: string
  schedules: TrainingSchedule[]
  canManage: boolean
  onUpdate: () => void
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export default function WeeklyScheduleView({ squadId, schedules, canManage, onUpdate }: WeeklyScheduleViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<TrainingSchedule | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Group schedules by day
  const schedulesByDay = useMemo(() => {
    const grouped: Record<string, TrainingSchedule[]> = {}
    DAYS_OF_WEEK.forEach(day => {
      grouped[day] = schedules
        .filter(s => s.day_of_week === day && s.active)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    return grouped
  }, [schedules])

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const getDuration = (startTime: string, endTime: string) => {
    const [startHours, startMinutes] = startTime.split(':').map(Number)
    const [endHours, endMinutes] = endTime.split(':').map(Number)
    
    const startTotal = startHours * 60 + startMinutes
    const endTotal = endHours * 60 + endMinutes
    const duration = endTotal - startTotal
    
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const handleCreateSchedule = (day?: string) => {
    setSelectedDay(day || null)
    setEditingSchedule(null)
    setShowCreateModal(true)
  }

  const handleEditSchedule = (schedule: TrainingSchedule) => {
    setEditingSchedule(schedule)
    setSelectedDay(null)
    setShowCreateModal(true)
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this training schedule?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('training_schedules')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error
      onUpdate()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('Failed to delete schedule')
    }
  }

  return (
    <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <SquadPageHeader
        title="Weekly Training Schedule"
        subtitle={`${schedules.filter(s => s.active).length} active sessions scheduled across the week`}
        actions={
          canManage ? (
            <button 
              className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-primary to-accent text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-primary/30 border border-white/10"
              onClick={() => handleCreateSchedule()}
            >
              <Plus size={18} />
              Add Session
            </button>
          ) : undefined
        }
      />

      {/* Weekly Grid */}
      <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl overflow-hidden">
        <div className="flex gap-4 min-h-[500px] overflow-x-auto">
          {DAYS_OF_WEEK.map(day => {
          const daySessions = schedulesByDay[day]
          const hasActiveSessions = daySessions.length > 0

          return (
            <div key={day} className="flex-1 min-w-[200px] bg-background-elevated rounded-xl border border-border/60 flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
              {/* Day Header */}
              <div className="flex justify-between items-center p-4 bg-linear-to-br from-background-secondary to-background-tertiary/50 border-b border-border/60">
                <div>
                  <h3 className="font-bold text-text-primary text-base mb-0.5">{day}</h3>
                  <span className="text-xs text-text-secondary font-medium">
                    {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {canManage && (
                  <button
                    className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all duration-200 hover:scale-110 shadow-sm"
                    onClick={() => handleCreateSchedule(day)}
                    title={`Add session for ${day}`}
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* Sessions */}
              <div className="flex-1 p-4 flex flex-col gap-3">
                {hasActiveSessions ? (
                  daySessions.map(session => (
                    <div key={session.id} className="bg-linear-to-br from-background-secondary to-background-tertiary/50 border border-border/60 rounded-xl p-4 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/40 transition-all duration-200 group">
                      <div className="flex justify-between items-start mb-3">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                          session.training_type === 'Swim' 
                            ? 'bg-accent/20 text-accent border border-accent/40' 
                            : 'bg-warning/20 text-warning border border-warning/40'
                        }`}>
                          {session.training_type === 'Swim' ? (
                            <MapPin size={14} />
                          ) : (
                            <Users size={14} />
                          )}
                          {session.training_type}
                        </div>
                        {canManage && (
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              className="w-7 h-7 rounded-lg bg-background-elevated hover:bg-primary/20 text-text-secondary hover:text-primary transition-colors duration-200 flex items-center justify-center shadow-sm border border-border/40"
                              onClick={() => handleEditSchedule(session)}
                              title="Edit session"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="w-7 h-7 rounded-lg bg-background-elevated hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors duration-200 flex items-center justify-center shadow-sm border border-border/40"
                              onClick={() => handleDeleteSchedule(session.id)}
                              title="Delete session"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-text-primary mb-2">
                        <Clock size={14} className="text-primary" />
                        <span className="text-sm font-semibold">
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </span>
                        <span className="text-xs text-text-secondary font-medium">
                          ({getDuration(session.start_time, session.end_time)})
                        </span>
                      </div>

                      {session.until && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary mt-2 pt-2 border-t border-border/40">
                          <Calendar size={12} />
                          <span>Until: {new Date(session.until).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-background-secondary border border-border/60 flex items-center justify-center text-text-muted mb-3 shadow-sm">
                      <Calendar size={24} />
                    </div>
                    <p className="text-text-secondary text-sm mb-3 font-medium">No sessions scheduled</p>
                    <button
                      className="px-4 py-2 bg-transparent text-primary border border-primary/40 hover:bg-primary/10 rounded-lg transition-all duration-200 text-sm font-semibold hover:scale-105"
                      onClick={() => handleCreateSchedule(day)}
                    >
                      Add Session
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        </div>
      </div>

      {/* Schedule Form Modal */}
      {showCreateModal && (
        <ScheduleFormModal
          squadId={squadId}
          schedule={editingSchedule}
          initialDay={selectedDay}
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}