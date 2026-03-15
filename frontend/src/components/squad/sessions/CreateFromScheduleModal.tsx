// components/squad/sessions/CreateFromScheduleModal.tsx
import { useState, useEffect } from 'react';
import { Calendar, CalendarCheck, CheckCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import DateInput from '@/components/ui/DateInput';
import { format } from 'date-fns';
import type { TrainingSchedule } from '@/services/sessionService';

type CreateFromScheduleModalProps = {
  open: boolean;
  onClose: () => void;
  squadId: string;
  schedules: TrainingSchedule[];
  onCreateBulkSessions: (schedules: TrainingSchedule[], startDate: Date, days: number) => Promise<void>;
  onSuccess?: () => void;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Map integer day_of_week to display name
function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? String(dayOfWeek);
}

export default function CreateFromScheduleModal({
  open,
  onClose,
  schedules,
  onCreateBulkSessions,
  onSuccess,
}: CreateFromScheduleModalProps) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [daysToCreate, setDaysToCreate] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setDaysToCreate(7);
      setError('');
    }
  }, [open]);

  // Calculate how many sessions will be created
  const calculateSessionCount = () => {
    let count = 0;
    const [y, m, d] = startDate.split('-').map(Number);
    const start = new Date(y, m - 1, d); // Local midnight — avoids UTC off-by-one

    for (let i = 0; i < daysToCreate; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const dayOfWeekNumber = currentDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeekNumber);
      count += daySchedules.length;
    }
    
    return count;
  };

  const sessionCount = calculateSessionCount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (schedules.length === 0) {
      setError('No training schedules available');
      return;
    }

    if (sessionCount === 0) {
      setError('No sessions will be created for the selected period');
      return;
    }

    try {
      setLoading(true);
      const [y, m, d] = startDate.split('-').map(Number);
      await onCreateBulkSessions(schedules, new Date(y, m - 1, d), daysToCreate);

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create sessions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Create Session from Schedule"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <p className="text-sm text-slate-100">
            <strong>💡 Tip:</strong> This will create training sessions for all schedules over the selected period.
          </p>
          {sessionCount > 0 && (
            <p className="text-sm text-primary font-semibold mt-2">
              {sessionCount} session{sessionCount !== 1 ? 's' : ''} will be created
            </p>
          )}
        </div>

        {/* Start Date Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Calendar size={18} className="text-primary" />
            <h3>Start Date</h3>
          </div>

          <DateInput
            label="Start creating sessions from"
            value={startDate}
            onChange={setStartDate}
            placeholder="Select start date"
          />
        </div>

        {/* Days to Create */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <CalendarCheck size={18} className="text-cyan-400" />
            <h3>Number of Days</h3>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-slate-400">
              Create sessions for the next
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="30"
                value={daysToCreate}
                onChange={(e) => setDaysToCreate(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
                className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:border-primary transition-colors"
              />
              <span className="text-slate-400">days</span>
            </div>
          </div>
        </div>

        {/* Schedule Preview */}
        {schedules.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-100 font-semibold">
              <CheckCircle size={18} className="text-green-500" />
              <h3>Active Schedules ({schedules.length})</h3>
            </div>

            <div className="bg-slate-800/50/50 border border-slate-700/30 rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between py-2 border-b border-slate-700/20 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        {getDayName(schedule.day_of_week)}
                      </span>
                      <span className="text-sm text-slate-100 capitalize">
                        {schedule.training_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {schedule.start_time} - {schedule.end_time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-slate-800/50 text-slate-100 rounded-lg font-semibold hover:bg-slate-800/70 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || sessionCount === 0}
            className="flex-1 px-4 py-3 bg-linear-to-r from-primary-dark via-primary to-accent text-white rounded-lg font-semibold hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Creating Sessions...' : `Create ${sessionCount} Session${sessionCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}


