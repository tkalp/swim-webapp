// WorkoutForm/index.tsx
import { useCallback, useEffect } from "react";
import { FileText, Search, Loader2 } from "lucide-react";
import { WorkoutMetricsCard } from '@/components/workout/WorkoutMetricsCard';
import { TagManager } from '@/components/workout/TagManager';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkoutForm } from '@/pages/WorkoutForm/hooks/useWorkoutForm';
import { useWorkoutAnalysis } from '@/hooks/useWorkoutAnalysis';
import {
  WorkoutFormHeader,
  ErrorAlert,
  WorkoutNameInput,
  EffortLevelSlider,
} from '@/pages/WorkoutForm/components';
import { WorkoutWritingGuide } from '@/components/workout';

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "Unclassified" },
  { value: "sprint", label: "Sprint" },
  { value: "endurance", label: "Endurance" },
  { value: "technique", label: "Technique" },
  { value: "im", label: "IM" },
  { value: "recovery", label: "Recovery" },
  { value: "race_prep", label: "Race Prep" },
] as const;

export default function WorkoutFormPage() {
  const { user } = useAuth();
  const {
    formData,
    setFormData,
    loading,
    loadingWorkout,
    error,
    setError,
    success,
    isEditMode,
    isValid,
    handleSubmit,
    handleCancel,
  } = useWorkoutForm();

  const {
    analysis,
    isAnalyzing,
    isStale,
    error: analysisError,
    analyze,
    markStale,
  } = useWorkoutAnalysis();

  const handleTextChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, rawDescription: value }));
    markStale();
  }, [setFormData, markStale]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = target.value.substring(0, start) + '\t' + target.value.substring(end);
      handleTextChange(newValue);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    }
  }, [handleTextChange]);

  const handleAnalyze = useCallback(async () => {
    await analyze(formData.rawDescription);
  }, [analyze, formData.rawDescription]);

  // Sync analysis results into formData when analysis completes
  useEffect(() => {
    if (analysis) {
      setFormData(prev => ({
        ...prev,
        totalMeters: analysis.total_meters,
        estimatedTimeMinutes: analysis.estimated_duration_minutes,
        jsonDescription: JSON.stringify({
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
        }),
      }));
    }
  }, [analysis, setFormData]);

  // Loading state
  if (loadingWorkout) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col">
        <div className="shrink-0 bg-background-elevated border-b border-border">
          <div className="max-w-7xl mx-auto px-3 py-2 md:px-4 md:py-3 flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
              onClick={handleCancel}
            >
              <span>Cancel</span>
            </button>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-linear-to-br from-primary-dark via-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                <FileText size={18} className="text-white md:w-6 md:h-6" />
              </div>
              <h1 className="text-base md:text-lg font-semibold text-text-primary">Loading Workout...</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-text-secondary text-sm md:text-base">Loading workout data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background-primary flex flex-col">
      {/* Header */}
      <WorkoutFormHeader
        isEditMode={isEditMode}
        isValid={isValid}
        loading={loading}
        success={success}
        visibility={formData.visibility}
        onVisibilityChange={(visibility) => setFormData(prev => ({ ...prev, visibility }))}
        onCancel={handleCancel}
      />

      {/* Error Alert */}
      <ErrorAlert error={error} onDismiss={() => setError("")} />

      {/* Form content - split panel */}
      <div className="flex-1 overflow-y-auto">
        <form id="workout-form" onSubmit={handleSubmit} className="h-full">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

              {/* Left Column - Form inputs */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Top row: Name + Classification */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1">
                    <WorkoutNameInput
                      value={formData.name}
                      onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                      autoFocus
                    />
                  </div>
                  <div className="sm:w-48">
                    <div className="bg-background-elevated rounded-xl border border-border/60 p-4 h-full">
                      <label className="block text-sm font-semibold text-text-primary mb-2">
                        Classification
                      </label>
                      <select
                        value={formData.classification}
                        onChange={(e) => setFormData(prev => ({ ...prev, classification: e.target.value }))}
                        className="w-full px-3 py-2 bg-background-tertiary/50 border border-border/40 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm"
                      >
                        {CLASSIFICATION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Main textarea */}
                <div className="bg-background-elevated rounded-xl border border-border/60 p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary">
                        Workout Description
                        <span className="text-red-400 ml-1">*</span>
                      </label>
                    </div>
                    <WorkoutWritingGuide />
                  </div>
                  <textarea
                    value={formData.rawDescription}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={"Write your workout here...\n\nWarm-up: 400m easy freestyle\nMain Set: 8 x 50m freestyle @ 1:00\nCool-down: 200m easy choice"}
                    className="w-full flex-1 min-h-[300px] lg:min-h-[400px] px-4 py-3 bg-background-tertiary/50 border border-border/40 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-y font-mono text-sm leading-relaxed"
                    rows={16}
                  />
                  <div className="text-xs text-text-muted mt-1">
                    Use Tab for indentation. Separate warm-up, main set, and cool-down sections.
                  </div>
                </div>

                {/* Tags */}
                {user?.id && (
                  <div className="bg-background-elevated rounded-xl border border-border/60 p-4">
                    <TagManager
                      coachId={user.id}
                      selectedTags={formData.selectedTags}
                      onTagsChange={(tags) => setFormData(prev => ({ ...prev, selectedTags: tags }))}
                    />
                  </div>
                )}
              </div>

              {/* Right Column - Analysis panel */}
              <div className="w-full lg:w-[440px] flex flex-col gap-4 shrink-0">
                {/* Analyze button */}
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !formData.rawDescription.trim()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Analyzing Workout...
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      Analyze Workout
                    </>
                  )}
                </button>

                {/* Analysis error */}
                {analysisError && (
                  <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {analysisError}
                  </div>
                )}

                {/* WorkoutMetricsCard */}
                <WorkoutMetricsCard analysis={analysis} isStale={isStale} isLoading={isAnalyzing} />

                {/* Effort slider */}
                <div className="mt-auto">
                  <EffortLevelSlider
                    value={formData.effortLevel}
                    onChange={(value) => setFormData(prev => ({ ...prev, effortLevel: value }))}
                  />
                </div>
              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
