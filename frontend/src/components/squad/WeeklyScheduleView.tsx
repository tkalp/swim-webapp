import { useState, useMemo } from 'react'
import { Calendar, Clock, Plus, Edit, Trash2, MapPin, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ScheduleFormModal from './ScheduleFormModal'

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
  onUpdate: () => void
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export default function WeeklyScheduleView({ squadId, schedules, onUpdate }: WeeklyScheduleViewProps) {
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
    <div className="bg-background-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-6 bg-background-elevated border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary-dark to-primary flex items-center justify-center text-white">
            <Calendar size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-1 bg-linear-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
              Weekly Training Schedule
            </h2>
            <p className="text-sm text-text-secondary">
              {schedules.filter(s => s.active).length} active sessions across the week
            </p>
          </div>
        </div>
        <button 
          className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-primary-dark to-primary text-white font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 border border-white/10"
          onClick={() => handleCreateSchedule()}
        >
          <Plus size={18} />
          Add Session
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="flex gap-px bg-border min-h-96 overflow-hidden">
        {DAYS_OF_WEEK.map(day => {
          const daySessions = schedulesByDay[day]
          const hasActiveSessions = daySessions.length > 0

          return (
            <div key={day} className="flex-1 bg-background-primary flex flex-col">
              {/* Day Header */}
              <div className="flex justify-between items-center p-3 bg-background-secondary border-b border-border">
                <div>
                  <h3 className="font-semibold text-text-primary text-sm">{day}</h3>
                  <span className="text-xs text-text-secondary">
                    {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all duration-200 hover:scale-110"
                  onClick={() => handleCreateSchedule(day)}
                  title={`Add session for ${day}`}
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Sessions */}
              <div className="flex-1 p-3 flex flex-col gap-2">
                {hasActiveSessions ? (
                  daySessions.map(session => (
                    <div key={session.id} className="bg-background-elevated border border-border rounded-lg p-3 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 group">
                      <div className="flex justify-between items-start mb-2">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                          session.training_type === 'Swim' 
                            ? 'bg-accent/20 text-accent border border-accent/30' 
                            : 'bg-warning/20 text-warning border border-warning/30'
                        }`}>
                          {session.training_type === 'Swim' ? (
                            <MapPin size={12} />
                          ) : (
                            <Users size={12} />
                          )}
                          {session.training_type}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            className="w-6 h-6 rounded-md bg-background-secondary hover:bg-primary/20 text-text-secondary hover:text-primary transition-colors duration-200 flex items-center justify-center"
                            onClick={() => handleEditSchedule(session)}
                            title="Edit session"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            className="w-6 h-6 rounded-md bg-background-secondary hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors duration-200 flex items-center justify-center"
                            onClick={() => handleDeleteSchedule(session.id)}
                            title="Delete session"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-text-primary mb-2">
                        <Clock size={12} />
                        <span className="text-sm font-medium">
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </span>
                        <span className="text-xs text-text-secondary">
                          ({getDuration(session.start_time, session.end_time)})
                        </span>
                      </div>

                      {session.until && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Calendar size={10} />
                          <span>Until: {new Date(session.until).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center text-text-muted mb-3">
                      <Calendar size={24} />
                    </div>
                    <p className="text-text-secondary text-sm mb-3">No sessions scheduled</p>
                    <button
                      className="px-3 py-2 bg-transparent text-primary border border-primary/30 hover:bg-primary/10 rounded-lg transition-colors duration-200 text-sm font-medium"
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