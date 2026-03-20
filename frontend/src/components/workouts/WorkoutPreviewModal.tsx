// components/workouts/WorkoutPreviewModal.tsx
import { useState, useEffect } from 'react';
import { Copy, TrendingUp, Activity, CheckCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { WorkoutStructuredView } from '@/components/workout/WorkoutStructuredView';
import WorkoutRatingStars from '@/components/workouts/WorkoutRatingStars';
import WorkoutVisibilityBadge from '@/components/workouts/WorkoutVisibilityBadge';
import { getWorkoutTemplate } from '@/services/workoutTemplateService';
import { cloneWorkout, type SharedWorkout } from '@/services/workoutSharingService';
import { useToast } from '@/contexts/ToastContext';

interface WorkoutPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutId: string;
  workoutPreview?: SharedWorkout;
  onCloned?: () => void;
}

export default function WorkoutPreviewModal({
  isOpen,
  onClose,
  workoutId,
  workoutPreview,
  onCloned
}: WorkoutPreviewModalProps) {
  const [workout, setWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && workoutId) {
      loadWorkoutDetails();
    }
  }, [isOpen, workoutId]);

  const loadWorkoutDetails = async () => {
    setLoading(true);
    try {
      const data = await getWorkoutTemplate(workoutId);
      console.log('Loaded workout data:', data);
      console.log('JSON Description:', data.json_description);
      setWorkout(data);
    } catch (error: any) {
      console.error('Error loading workout:', error);
      showToast('Failed to load workout details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async () => {
    setCloning(true);
    try {
      await cloneWorkout(workoutId);
      showToast(`Cloned "${workoutPreview?.name || 'workout'}" to your library!`, 'success');
      onCloned?.();
      onClose();
    } catch (error: any) {
      showToast(error.message || 'Failed to clone workout', 'error');
    } finally {
      setCloning(false);
    }
  };

  const handleCopy = () => {
    if (!workout?.raw_description) return;
    navigator.clipboard.writeText(workout.raw_description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Workout Preview"
      size="4xl"
      closeOnBackdrop={true}
    >
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading workout...</p>
        </div>
      ) : !workout ? (
        <div className="py-12 text-center text-slate-400">
          Failed to load workout details
        </div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          {/* Header Section */}
          <div className="flex items-start gap-4 -mt-1 sticky top-0 bg-slate-900/95 backdrop-blur-sm pb-4 z-10">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Activity size={24} className="text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-white mb-1">
                {workoutPreview?.name || workout?.name || 'Workout Preview'}
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {workoutPreview?.coach_name && (
                  <span className="text-sm text-slate-400">by {workoutPreview.coach_name}</span>
                )}
                {workout.classification && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium capitalize">
                    <TrendingUp size={14} />
                    {workout.classification}
                  </span>
                )}
                {workoutPreview && (
                  <WorkoutVisibilityBadge visibility={workoutPreview.visibility} />
                )}
              </div>
            </div>
          </div>

          {/* Community Rating */}
          {workoutPreview && (
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-xl p-5">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-xs text-slate-400 mb-2 font-medium">Community Rating</div>
                  <WorkoutRatingStars
                    rating={workoutPreview.effectiveness_rating}
                    ratingCount={workoutPreview.rating_count}
                    size="md"
                  />
                </div>
                <div className="h-10 w-px bg-slate-700/50" />
                <div>
                  <div className="text-xs text-slate-400 mb-1">Clones</div>
                  <div className="text-xl font-bold text-white">{workoutPreview.clone_count}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Uses</div>
                  <div className="text-xl font-bold text-white">{workoutPreview.times_used}</div>
                </div>
              </div>
            </div>
          )}

          {/* Structured Workout View */}
          <WorkoutStructuredView
            jsonDescription={workout.json_description}
            rawDescription={workout.raw_description}
            description={workout.description}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Close
            </button>
            <button
              onClick={handleClone}
              disabled={cloning}
              className="px-6 py-2.5 rounded-lg font-semibold bg-linear-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy className="w-4 h-4" />
              {cloning ? 'Cloning...' : 'Clone to My Library'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
