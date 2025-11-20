import { useState, useEffect } from 'react'
import { X, Clock, Calendar, MapPin, Users } from 'lucide-react'
import { useScheduleApi } from '@/hooks/api'

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

type ScheduleFormModalProps = {
  squadId: string
  schedule?: TrainingSchedule | null
  initialDay?: string | null
  onClose: () => void
  onSave: () => void
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const TRAINING_TYPES = ['Swim', 'Dryland'] as const

const TIME_OPTIONS = [
  '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00'
]

export default function ScheduleFormModal({ 
  squadId, 
  schedule, 
  initialDay, 
  onClose, 
  onSave 
}: ScheduleFormModalProps) {
  const { createSchedule, updateSchedule } = useScheduleApi()
  const [formData, setFormData] = useState({
    day_of_week: (initialDay as any) || 'Monday',
    start_time: '17:00',
    end_time: '18:00',
    training_type: 'Swim' as 'Swim' | 'Dryland',
    active: true,
    until: '' as string
  })

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (schedule) {
      setFormData({
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        training_type: schedule.training_type,
        active: schedule.active,
        until: schedule.until || ''
      })
    }
  }, [schedule])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (formData.start_time >= formData.end_time) {
      newErrors.time = 'End time must be after start time'
    }

    if (formData.until) {
      const untilDate = new Date(formData.until)
      if (untilDate <= new Date()) {
        newErrors.until = 'End date must be in the future'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const data = {
        squad_id: squadId,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        training_type: formData.training_type,
        active: formData.active,
        until: formData.until || null
      }

      if (schedule) {
        // Update existing schedule - store is automatically updated
        await updateSchedule(schedule.id, squadId, data)
      } else {
        // Create new schedule - store is automatically updated
        await createSchedule(data)
      }

      onSave() // Close modal
    } catch (error) {
      // Error toast is automatically shown by the hook
      console.error('Error saving schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-background-elevated border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-border bg-background-primary">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary-dark to-primary flex items-center justify-center text-white">
                <Calendar size={20} />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">{schedule ? 'Edit Schedule' : 'New Schedule'}</h2>
            </div>
            <button 
              type="button" 
              className="w-9 h-9 rounded-lg bg-background-secondary hover:bg-background-tertiary border-none flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-200"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Day of Week */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
                <Calendar size={16} />
                Day of Week
              </label>
              <div className="flex gap-2 flex-wrap">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day}
                    type="button"
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      formData.day_of_week === day 
                        ? 'bg-primary text-white border-primary' 
                        : 'bg-background-secondary text-text-secondary border-border hover:border-primary/50 hover:bg-primary/10'
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, day_of_week: day }))}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Training Type */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
                <Users size={16} />
                Training Type
              </label>
              <div className="flex gap-3">
                {TRAINING_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all duration-200 border ${
                      formData.training_type === type 
                        ? 'bg-primary text-white border-primary' 
                        : 'bg-background-secondary text-text-secondary border-border hover:border-primary/50 hover:bg-primary/10'
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, training_type: type }))}
                  >
                    {type === 'Swim' ? <MapPin size={16} /> : <Users size={16} />}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Clock size={14} />
                  Start Time
                </label>
                <select
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="w-full p-3 bg-background-primary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary transition-colors duration-200"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>
                      {formatTime(time)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Clock size={14} />
                  End Time
                </label>
                <select
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="w-full p-3 bg-background-primary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary transition-colors duration-200"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>
                      {formatTime(time)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {errors.time && (
              <div className="text-danger text-xs mt-1">{errors.time}</div>
            )}

            {/* End Date (Optional) */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                <Calendar size={14} />
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.until}
                onChange={(e) => setFormData(prev => ({ ...prev, until: e.target.value }))}
                className="w-full p-3 bg-background-primary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-primary transition-colors duration-200"
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.until && (
                <div className="text-danger text-xs mt-1">{errors.until}</div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`w-12 h-7 rounded-full transition-colors duration-200 ${
                    formData.active ? 'bg-primary' : 'bg-background-secondary'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-200 mt-1 ml-1 ${
                      formData.active ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {formData.active ? 'Active Schedule' : 'Inactive Schedule'}
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-border bg-background-primary">
            <button 
              type="button" 
              className="px-5 py-2.5 border border-border bg-background-secondary text-text-secondary hover:bg-background-tertiary hover:text-text-primary rounded-lg transition-colors duration-200 font-medium"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2.5 bg-linear-to-r from-primary-dark to-primary text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 rounded-lg transition-all duration-200 font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? 'Saving...' : (schedule ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}