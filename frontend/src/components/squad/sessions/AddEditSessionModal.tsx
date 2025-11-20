// components/squad/sessions/AddEditSessionModal.tsx
import { useState, useEffect } from 'react';
import { Clock, Calendar, Type, FileText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import DateInput from '@/components/ui/DateInput';
import CustomSelect, { type Option } from '@/components/ui/CustomSelect';
import { format } from 'date-fns';

type SessionFormData = {
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  training_type: string;
  workout_id?: string | null;
};

type AddEditSessionModalProps = {
  open: boolean;
  onClose: () => void;
  squadId: string;
  sessionId?: string;
  initialData?: Partial<SessionFormData>;
  onSuccess?: () => void;
  onSubmit: (data: SessionFormData) => Promise<void>;
};

const TRAINING_TYPES: Option[] = [
  { value: 'technique', label: 'Technique' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'speed', label: 'Speed' },
  { value: 'race_pace', label: 'Race Pace' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'mixed', label: 'Mixed' },
];

export default function AddEditSessionModal({
  open,
  onClose,
  squadId,
  sessionId,
  initialData,
  onSuccess,
  onSubmit,
}: AddEditSessionModalProps) {
  const isEdit = !!sessionId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<SessionFormData>({
    start_date: initialData?.start_date?.split('T')[0] ?? format(new Date(), 'yyyy-MM-dd'),
    start_time: initialData?.start_time ?? '06:00',
    end_date: initialData?.end_date?.split('T')[0] ?? format(new Date(), 'yyyy-MM-dd'),
    end_time: initialData?.end_time ?? '07:00',
    training_type: initialData?.training_type ?? 'mixed',
    workout_id: initialData?.workout_id ?? null,
  });

  // Reset form when modal opens/closes or initial data changes
  useEffect(() => {
    if (open && initialData) {
      setFormData({
        start_date: initialData.start_date?.split('T')[0] ?? format(new Date(), 'yyyy-MM-dd'),
        start_time: initialData.start_time ?? '06:00',
        end_date: initialData.end_date?.split('T')[0] ?? format(new Date(), 'yyyy-MM-dd'),
        end_time: initialData.end_time ?? '07:00',
        training_type: initialData.training_type ?? 'mixed',
        workout_id: initialData.workout_id ?? null,
      });
    } else if (open && !initialData) {
      setFormData({
        start_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '06:00',
        end_date: format(new Date(), 'yyyy-MM-dd'),
        end_time: '07:00',
        training_type: 'mixed',
        workout_id: null,
      });
    }
    setError('');
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const startDateTime = new Date(`${formData.start_date}T${formData.start_time}`);
    const endDateTime = new Date(`${formData.end_date}T${formData.end_time}`);

    if (endDateTime <= startDateTime) {
      setError('End time must be after start time');
      return;
    }

    try {
      setLoading(true);
      await onSubmit(formData);
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? 'Edit Training Session' : 'Add Training Session'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger text-sm">
            {error}
          </div>
        )}

        {/* Date and Time Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <Calendar size={18} className="text-primary" />
            <h3>Date & Time</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <DateInput
              label="Start Date"
              value={formData.start_date}
              onChange={(v) => setFormData({ ...formData, start_date: v })}
              placeholder="Select start date"
            />

            {/* Start Time */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
                <Clock size={14} />
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full bg-background-tertiary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>

            {/* End Date */}
            <DateInput
              label="End Date"
              value={formData.end_date}
              onChange={(v) => setFormData({ ...formData, end_date: v })}
              placeholder="Select end date"
            />

            {/* End Time */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
                <Clock size={14} />
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full bg-background-tertiary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* Session Details Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <Type size={18} className="text-accent" />
            <h3>Session Details</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Training Type */}
            <CustomSelect
              label="Training Type"
              value={formData.training_type}
              onChange={(v) => setFormData({ ...formData, training_type: v })}
              options={TRAINING_TYPES}
            />

            {/* Workout ID (Optional) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
                <FileText size={14} />
                Workout ID (Optional)
              </label>
              <input
                type="text"
                value={formData.workout_id ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, workout_id: e.target.value || null })
                }
                className="w-full bg-background-tertiary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Enter workout ID or leave empty"
              />
              <p className="text-xs text-text-muted">Link this session to a specific workout (optional)</p>
            </div>
          </div>
        </div>

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
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-dark via-primary to-accent text-white rounded-lg font-semibold hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Session' : 'Create Session'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
