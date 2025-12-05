// components/workouts/WorkoutPreviewModal.tsx
import { useState, useEffect } from 'react';
import { Copy, Calendar, Timer, Flame, BarChart3, TrendingUp, Activity, Target, Zap, CheckCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import WorkoutBreakdownCharts from '@/components/workout/WorkoutBreakdownCharts';
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

// Helper to normalize different JSON description formats
function normalizeJsonDescription(jsonDesc: any): { estimate: any } | null {
  if (!jsonDesc) return null;
  
  // New versioned format
  if ('version' in jsonDesc && 'analysis' in jsonDesc) {
    const analysis = jsonDesc.analysis;
    return {
      estimate: {
        totalDistance: analysis.total_meters,
        totalMinutes: analysis.estimated_duration_minutes,
        estimatedCalories: analysis.estimated_calories,
        difficulty: analysis.classification?.toLowerCase() || 'moderate',
        intensityScore: analysis.intensity_score || 0,
        strokeBreakdown: {
          freestyle: analysis.stroke_breakdown?.freestyle || 0,
          backstroke: analysis.stroke_breakdown?.backstroke || 0,
          breaststroke: analysis.stroke_breakdown?.breaststroke || 0,
          butterfly: analysis.stroke_breakdown?.butterfly || 0,
          individualMedley: analysis.stroke_breakdown?.IM || analysis.stroke_breakdown?.im || 0,
          choice: analysis.stroke_breakdown?.choice || 0,
          mixed: analysis.stroke_breakdown?.mixed || 0
        },
        activityBreakdown: {
          swim: analysis.activity_breakdown?.swim || 0,
          kick: analysis.activity_breakdown?.kick || 0,
          pull: analysis.activity_breakdown?.pull || 0,
          drill: analysis.activity_breakdown?.drill || 0,
          mixed: analysis.activity_breakdown?.mixed || 0
        }
      }
    };
  }
  
  // Already in old format
  if ('estimate' in jsonDesc) {
    return jsonDesc;
  }
  
  return null;
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

  const normalized = workout?.json_description ? normalizeJsonDescription(workout.json_description) : null;
  const estimate = normalized?.estimate;

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
                {estimate?.difficulty && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium">
                    <TrendingUp size={14} />
                    {estimate.difficulty}
                  </span>
                )}
                {workoutPreview && (
                  <WorkoutVisibilityBadge visibility={workoutPreview.visibility} />
                )}
              </div>
            </div>
          </div>
          {/* Stats Grid */}
          {estimate && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-5 hover:border-cyan-500/40 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <BarChart3 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="text-xs font-semibold text-cyan-400/60 uppercase tracking-wider">Distance</div>
                  </div>
                  <div className="text-3xl font-black bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    {(estimate.totalDistance || 0).toLocaleString()}m
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-5 hover:border-purple-500/40 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <Timer className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-xs font-semibold text-purple-400/60 uppercase tracking-wider">Duration</div>
                  </div>
                  <div className="text-3xl font-black bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {Math.round(estimate.totalMinutes || 0)} min
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 p-5 hover:border-orange-500/40 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <Flame className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="text-xs font-semibold text-orange-400/60 uppercase tracking-wider">Calories</div>
                  </div>
                  <div className="text-3xl font-black bg-linear-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                    {estimate.estimatedCalories || 0}
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-5 hover:border-emerald-500/40 transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Zap className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-xs font-semibold text-emerald-400/60 uppercase tracking-wider">Effort</div>
                  </div>
                  <div className="text-3xl font-black bg-linear-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    {workout.effort_level || estimate.intensityScore || 0}/10
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {/* Workout Description */}
          {workout.raw_description && (
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
                <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Workout Details</h3>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    copied
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                  title={copied ? "Copied!" : "Copy to clipboard"}
                >
                  {copied ? (
                    <>
                      <CheckCircle size={14} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="p-5 max-h-96 overflow-y-auto custom-scrollbar">
                <div className="flex gap-3">
                  {/* Line numbers */}
                  <div className="flex flex-col text-right select-none opacity-40 sticky top-0">
                    {workout.raw_description.split('\n').map((_: string, index: number) => (
                      <div key={index} className="text-[13px] leading-[1.8] font-mono text-slate-500 tabular-nums">
                        {index + 1}
                      </div>
                    ))}
                  </div>
                  {/* Content */}
                  <pre className="flex-1 whitespace-pre-wrap font-mono text-[13px] leading-[1.8] text-slate-300">
                    {workout.raw_description}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          {estimate && (
            <WorkoutBreakdownCharts estimate={estimate} />
          )}

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
