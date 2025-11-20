// components/swimmers/bestTimes/AddEditWorkoutResultModal.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit, Ruler, Clock, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CustomSelect, { type Option } from '@/components/ui/CustomSelect';
import DateInput from '@/components/ui/DateInput';
import Modal from '@/components/ui/Modal';
import { format } from 'date-fns';

type WorkoutResultFormData = {
  swimmer_id: string;
  distance: number;
  stroke: string;
  activity: string;
  equipment: string;
  units: string;
  time_result: string; // Format: "MM:SS.ss" or "HH:MM:SS.ss"
  performed_on: string;
  training_session_id?: string;
  result_units?: string;
};

type AddEditWorkoutResultModalProps = {
  open: boolean;
  onClose: () => void;
  swimmerId: string;
  resultId?: string; // If editing
  initialData?: Partial<WorkoutResultFormData>;
  onSuccess?: () => void;
};

export default function AddEditWorkoutResultModal({
  open,
  onClose,
  swimmerId,
  resultId,
  initialData,
  onSuccess,
}: AddEditWorkoutResultModalProps) {
  const isEdit = !!resultId;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState<WorkoutResultFormData>({
    swimmer_id: swimmerId,
    distance: initialData?.distance ?? 50,
    stroke: initialData?.stroke ?? 'free',
    activity: initialData?.activity ?? 'swim',
    equipment: initialData?.equipment ?? 'none',
    units: initialData?.units ?? 'meters',
    time_result: initialData?.time_result ?? '',
    performed_on: initialData?.performed_on ?? format(new Date(), 'yyyy-MM-dd'),
    result_units: initialData?.result_units ?? 'SCM',
  });

  // Load existing data if editing
  useEffect(() => {
    if (isEdit && open) {
      loadWorkoutResult();
    }
  }, [isEdit, resultId, open]);

  const loadWorkoutResult = async () => {
    if (!resultId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workout_result')
        .select('*')
        .eq('id', resultId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setFormData({
          swimmer_id: data.swimmer_id || swimmerId,
          distance: data.distance ?? 50,
          stroke: data.stroke ?? 'free',
          activity: data.activity ?? 'swim',
          equipment: data.equipment ?? 'none',
          units: data.units ?? 'meters',
          time_result: data.time_result ?? '',
          performed_on: data.performed_on ?? format(new Date(), 'yyyy-MM-dd'),
          training_session_id: data.training_session_id || undefined,
          result_units: data.result_units ?? 'SCM',
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.distance || formData.distance <= 0) {
      setError('Distance must be greater than 0');
      return;
    }
    
    if (!formData.time_result || !validateTimeFormat(formData.time_result)) {
      setError('Time must be in format SS.mm (e.g., 32.21), MM:SS.ss (e.g., 1:23.45), or HH:MM:SS.ss');
      return;
    }
    
    try {
      setLoading(true);
      
      // Convert time to PostgreSQL interval format
      const intervalValue = convertToInterval(formData.time_result);
      
      const payload = {
        swimmer_id: formData.swimmer_id,
        distance: formData.distance,
        stroke: formData.stroke,
        activity: formData.activity,
        equipment: formData.equipment,
        units: formData.units,
        time_result: intervalValue,
        performed_on: formData.performed_on,
        training_session_id: formData.training_session_id || null,
        result_units: formData.result_units,
      };
      
      if (isEdit) {
        const { error } = await supabase
          .from('workout_result')
          .update(payload)
          .eq('id', resultId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('workout_result')
          .insert(payload);
        
        if (error) throw error;
      }
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save workout result');
    } finally {
      setLoading(false);
    }
  };

  const validateTimeFormat = (time: string): boolean => {
    // Accepts:
    // - SS.mm (e.g., 32.21 for 32.21 seconds)
    // - MM:SS.ss (e.g., 1:23.45 for 1 min 23.45 sec)
    // - HH:MM:SS.ss (e.g., 00:01:23.45)
    const secondsOnly = /^\d{1,2}\.\d{1,2}$/; // 32.21
    const minutesSeconds = /^\d{1,2}:\d{2}(\.\d{1,2})?$/; // 1:23.45
    const hoursMinutesSeconds = /^\d{1,2}:\d{2}:\d{2}(\.\d{1,2})?$/; // 00:01:23.45
    
    return secondsOnly.test(time) || minutesSeconds.test(time) || hoursMinutesSeconds.test(time);
  };

  const convertToInterval = (time: string): string => {
    // Convert to PostgreSQL interval format (HH:MM:SS.ss)
    
    // If it's just seconds (e.g., 32.21)
    if (!time.includes(':')) {
      const seconds = parseFloat(time);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `00:${String(mins).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
    }
    
    const parts = time.split(':');
    if (parts.length === 2) {
      // MM:SS.ss format - add hours
      return `00:${time}`;
    }
    
    // Already HH:MM:SS.ss
    return time;
  };

  const strokeOptions: Option[] = [
    { value: 'free', label: 'Freestyle' },
    { value: 'back', label: 'Backstroke' },
    { value: 'breast', label: 'Breaststroke' },
    { value: 'fly', label: 'Butterfly' },
    { value: 'im', label: 'Individual Medley' },
  ];

  const activityOptions: Option[] = [
    { value: 'swim', label: 'Swim' },
    { value: 'kick', label: 'Kick' },
    { value: 'pull', label: 'Pull' },
    { value: 'drill', label: 'Drill' },
  ];

  const equipmentOptions: Option[] = [
    { value: 'none', label: 'None' },
    { value: 'fins', label: 'Fins' },
    { value: 'paddles', label: 'Paddles' },
    { value: 'pullbuoy', label: 'Pull Buoy' },
    { value: 'kickboard', label: 'Kickboard' },
    { value: 'snorkel', label: 'Snorkel' },
  ];

  const resultUnitsOptions: Option[] = [
    { value: 'SCM', label: 'SCM (Short Course Meters)' },
    { value: 'LCM', label: 'LCM (Long Course Meters)' },
    { value: 'SCY', label: 'SCY (Short Course Yards)' },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEdit ? 'Edit Workout Result' : 'Add Workout Result'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger text-sm">
              {error}
            </div>
          )}

          {/* Event Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-semibold">
              <Target size={18} className="text-primary" />
              <h3>Event Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Distance */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
                  <Ruler size={14} />
                  Distance
                </label>
                <input
                  type="number"
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: parseInt(e.target.value) || 0 })}
                  className="w-full bg-background-tertiary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="50"
                  required
                />
              </div>

              {/* Pool Type / Result Units */}
              <CustomSelect
                label="Pool Type"
                value={formData.result_units || 'SCM'}
                onChange={(v) => setFormData({ ...formData, result_units: v })}
                options={resultUnitsOptions}
              />

              {/* Stroke */}
              <CustomSelect
                label="Stroke"
                value={formData.stroke}
                onChange={(v) => setFormData({ ...formData, stroke: v })}
                options={strokeOptions}
              />

              {/* Activity */}
              <CustomSelect
                label="Activity"
                value={formData.activity}
                onChange={(v) => setFormData({ ...formData, activity: v })}
                options={activityOptions}
              />

              {/* Equipment */}
              <CustomSelect
                label="Equipment"
                value={formData.equipment}
                onChange={(v) => setFormData({ ...formData, equipment: v })}
                options={equipmentOptions}
              />
            </div>
          </div>

          {/* Result Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-semibold">
              <Clock size={18} className="text-accent" />
              <h3>Result Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Time Result */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-2">
                  <Clock size={14} />
                  Time
                </label>
                <input
                  type="text"
                  value={formData.time_result}
                  onChange={(e) => setFormData({ ...formData, time_result: e.target.value })}
                  className="w-full bg-background-tertiary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono"
                  placeholder="32.21 or 1:23.45 or 00:01:23.45"
                  required
                />
                <p className="text-xs text-text-muted">Format: SS.mm, MM:SS.ss, or HH:MM:SS.ss</p>
              </div>

              {/* Date */}
              <DateInput
                label="Date Performed"
                value={formData.performed_on}
                onChange={(v) => setFormData({ ...formData, performed_on: v })}
                placeholder="Select date"
              />
            </div>
          </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-background-tertiary border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-elevated hover:border-primary/30 transition-all font-medium"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-dark via-primary to-accent text-white rounded-lg font-semibold hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {isEdit ? <Edit size={16} /> : <Plus size={16} />}
                {isEdit ? 'Update Result' : 'Add Result'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
