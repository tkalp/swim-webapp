// components/squad/sessions/CreateFromScheduleModal.tsx
import { useState, useEffect } from 'react';
import { Calendar, CalendarCheck, CheckCircle } from 'lucide-react';
import Modal from '../../ui/Modal';
import DateInput from '../../ui/DateInput';
import { format } from 'date-fns';
import type { TrainingSchedule } from '../../../services/sessionService';

type CreateFromScheduleModalProps = {
  open: boolean;
  onClose: () => void;
  squadId: string;
  schedules: TrainingSchedule[];
  onCreateBulkSessions: (schedules: TrainingSchedule[], startDate: Date, days: number) => Promise<void>;
  onSuccess?: () => void;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    const start = new Date(startDate);
    
    for (let i = 0; i < daysToCreate; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const dayOfWeekNumber = currentDate.getDay();
      const dayOfWeekString = DAY_NAMES[dayOfWeekNumber];
      const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeekString);
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
      await onCreateBulkSessions(schedules, new Date(startDate), daysToCreate);

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
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger text-sm">
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <p className="text-sm text-text-primary">
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
          <div className="flex items-center gap-2 text-text-primary font-semibold">
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
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <CalendarCheck size={18} className="text-accent" />
            <h3>Number of Days</h3>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-text-secondary">
              Create sessions for the next
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="30"
                value={daysToCreate}
                onChange={(e) => setDaysToCreate(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
                className="flex-1 px-4 py-3 bg-background-tertiary border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
              <span className="text-text-secondary">days</span>
            </div>
          </div>
        </div>

        {/* Schedule Preview */}
        {schedules.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-semibold">
              <CheckCircle size={18} className="text-success" />
              <h3>Active Schedules ({schedules.length})</h3>
            </div>

            <div className="bg-background-tertiary/50 border border-border/30 rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-text-tertiary uppercase">
                        {schedule.day_of_week}
                      </span>
                      <span className="text-sm text-text-primary capitalize">
                        {schedule.training_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary">
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
            className="flex-1 px-4 py-3 bg-background-tertiary text-text-primary rounded-lg font-semibold hover:bg-background-secondary transition-all disabled:opacity-50"
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
