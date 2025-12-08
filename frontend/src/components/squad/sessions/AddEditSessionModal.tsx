// components/squad/sessions/AddEditSessionModal.tsx
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import DateInput from '@/components/ui/DateInput';
import TimeInput from '@/components/ui/TimeInput';
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
    training_type: 'Swim', // Default to 'Swim'
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
        training_type: initialData.training_type ?? 'Swim',
        workout_id: initialData.workout_id ?? null,
      });
    } else if (open && !initialData) {
      setFormData({
        start_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '06:00',
        end_date: format(new Date(), 'yyyy-MM-dd'),
        end_time: '07:00',
        training_type: 'Swim',
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
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Single Date Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Calendar size={18} className="text-cyan-400" />
            <h3>Session Date & Time</h3>
          </div>

          {/* Date */}
          <DateInput
            label="Session Date"
            value={formData.start_date}
            onChange={(v) => setFormData({ ...formData, start_date: v, end_date: v })}
            placeholder="Select date"
          />

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <TimeInput
              label="Start Time"
              value={formData.start_time}
              onChange={(v) => setFormData({ ...formData, start_time: v })}
            />
            
            <TimeInput
              label="End Time"
              value={formData.end_time}
              onChange={(v) => setFormData({ ...formData, end_time: v })}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-700/30">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-slate-800/60 hover:bg-slate-800/80 text-slate-100 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-linear-to-r from-cyan-600 via-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Session' : 'Create Session'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
