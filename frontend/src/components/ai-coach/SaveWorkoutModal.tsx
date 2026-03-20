import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useWorkoutAnalysis } from '@/hooks/useWorkoutAnalysis';
import { WorkoutMetricsCard } from '@/components/workout/WorkoutMetricsCard';
import { createWorkoutTemplate } from '@/services/workoutTemplateService';
import { authenticatedFetch } from '@/lib/apiClient';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { splitWorkoutText, stripMarkdown, stripNotesHeader } from '@/utils/cleanWorkoutText';

const CLASSIFICATIONS = [
  { value: 'sprint', label: 'Sprint' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'technique', label: 'Technique' },
  { value: 'im', label: 'IM' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'race_prep', label: 'Race Prep' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'network', label: 'Network' },
  { value: 'public', label: 'Public' },
] as const;

export interface SaveWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (workoutId: string) => void;
  workoutText: string;
  conversationId: string;
  messageId: string;
}

export function SaveWorkoutModal({
  isOpen,
  onClose,
  onSaved,
  workoutText,
  conversationId,
  messageId,
}: SaveWorkoutModalProps) {
  const { user } = useAuth();
  const { analysis, isAnalyzing, isStale, error: analysisError, analyze } = useWorkoutAnalysis();

  const [name, setName] = useState('New Workout');
  const [cleanedWorkout, setCleanedWorkout] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('endurance');
  const [effortLevel, setEffortLevel] = useState(5);
  const [visibility, setVisibility] = useState<'private' | 'network' | 'public'>('private');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // On open: split workout/notes, strip markdown, analyze clean text
  useEffect(() => {
    if (isOpen && workoutText) {
      const { workout, notes } = splitWorkoutText(workoutText);
      const clean = stripMarkdown(workout);

      setCleanedWorkout(clean);
      setDescription(notes ? stripNotesHeader(notes) : '');

      // Analyze the clean workout text (not the raw markdown)
      analyze(clean);
    }
  }, [isOpen, workoutText, analyze]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Please enter a workout name.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Step 1: Create the workout template
      const result = await createWorkoutTemplate({
        name: name.trim(),
        description: description.trim(),
        raw_description: cleanedWorkout,
        total_meters: analysis?.total_meters || 0,
        estimated_time_minutes: analysis?.estimated_duration_minutes || 0,
        estimated_calories: 0,
        effort_level: effortLevel,
        create_by_coach: user?.id || '',
        json_description: analysis ? {
          sections: analysis.sections,
          totals: {
            total_meters: analysis.total_meters,
            total_sets: analysis.total_sets,
            estimated_duration_minutes: analysis.estimated_duration_minutes,
            rest_time_minutes: analysis.rest_time_minutes,
            stroke_breakdown: analysis.stroke_breakdown,
            activity_breakdown: analysis.activity_breakdown,
            energy_zone_breakdown: analysis.energy_zone_breakdown,
          },
        } : undefined,
        classification,
        visibility,
      });

      const workoutId = result.id;

      // Step 2: PATCH the AI Coach message metadata
      await authenticatedFetch(
        `${API_BASE_URL}/ai-coach/conversations/${conversationId}/messages/${messageId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            metadata: {
              saved_workout_id: workoutId,
              saved_workout_title: name.trim(),
            },
          }),
        }
      );

      // Step 3: Notify parent
      onSaved(workoutId);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save workout');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Save Workout</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name input */}
          <div>
            <label htmlFor="workout-name" className="block text-sm font-medium text-slate-300 mb-1">
              Workout Name
            </label>
            <input
              id="workout-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              placeholder="Enter workout name"
            />
          </div>

          {/* Workout text (editable — coach can tweak before saving) */}
          <div>
            <label htmlFor="workout-text" className="block text-sm font-medium text-slate-300 mb-1">
              Workout
            </label>
            <textarea
              id="workout-text"
              value={cleanedWorkout}
              onChange={(e) => {
                setCleanedWorkout(e.target.value);
                // Mark analysis as stale since text changed
                if (analysis) {
                  analyze(e.target.value);
                }
              }}
              className="w-full rounded-md border border-slate-700 bg-slate-800/50 text-slate-100 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-y"
              rows={10}
            />
          </div>

          {/* Description / Coaching Notes */}
          <div>
            <label htmlFor="workout-description" className="block text-sm font-medium text-slate-300 mb-1">
              Description / Coaching Notes
            </label>
            <textarea
              id="workout-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-y"
              placeholder="Add coaching notes, purpose, or description..."
              rows={4}
            />
          </div>

          {/* Analysis metrics */}
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing workout...
            </div>
          ) : analysisError ? (
            <div className="text-sm text-red-400">{analysisError}</div>
          ) : (
            <WorkoutMetricsCard analysis={analysis} isStale={isStale} />
          )}

          {/* Classification */}
          <div>
            <label htmlFor="classification" className="block text-sm font-medium text-slate-300 mb-1">
              Classification
            </label>
            <select
              id="classification"
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {CLASSIFICATIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Effort level */}
          <div>
            <label htmlFor="effort-level" className="block text-sm font-medium text-slate-300 mb-1">
              Effort Level: <span className="text-slate-100">{effortLevel}</span>
            </label>
            <input
              id="effort-level"
              type="range"
              min={1}
              max={10}
              value={effortLevel}
              onChange={(e) => setEffortLevel(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>1 - Easy</span>
              <span>10 - Max</span>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label htmlFor="visibility" className="block text-sm font-medium text-slate-300 mb-1">
              Visibility
            </label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'private' | 'network' | 'public')}
              className="w-full rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {saveError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 text-white text-sm font-medium hover:from-cyan-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
