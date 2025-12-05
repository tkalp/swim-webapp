// WorkoutForm/index.tsx
import { useState } from "react";
import { FileText } from "lucide-react";
import { RealtimeWorkoutAnalyzer } from '@/components/workout';
import { TagManager } from '@/components/workout/TagManager';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkoutForm } from '@/pages/WorkoutForm/hooks/useWorkoutForm';
import {
  WorkoutFormHeader,
  ErrorAlert,
  WorkoutNameInput,
  WorkoutDescriptionTextarea,
  EffortLevelSlider,
  EditMetricModal,
} from '@/pages/WorkoutForm/components';

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
    handleAnalysisUpdate,
  } = useWorkoutForm();

  // Modal state for editing metrics
  const [editingMetric, setEditingMetric] = useState<{
    type: 'distance' | 'duration' | 'calories';
    value: number;
  } | null>(null);

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
        onVisibilityChange={(visibility) => setFormData({ ...formData, visibility })}
        onCancel={handleCancel}
      />

      {/* Error Alert */}
      <ErrorAlert error={error} onDismiss={() => setError("")} />

      {/* Form - Simple column on mobile, split on desktop */}
      <div className="flex-1 overflow-y-auto">
        <form id="workout-form" onSubmit={handleSubmit} className="h-full">
          <div className="h-full max-w-[1800px] mx-auto p-3 sm:p-4 lg:p-5">
            <div className="h-full flex flex-col lg:flex-row gap-4">
              
              {/* Left Column - Workout Details */}
              <div className="flex flex-col gap-4 lg:flex-1 lg:overflow-y-auto lg:pr-4">
                <WorkoutNameInput
                  value={formData.name}
                  onChange={(value) => setFormData({ ...formData, name: value })}
                  autoFocus
                />

                {/* Brief Description */}
                <div className="bg-background-elevated rounded-xl border border-border/60 p-4">
                  <label className="block text-sm font-semibold text-text-primary mb-2">
                    Brief Description
                    <span className="text-text-muted font-normal ml-2">(Optional, 500 char max)</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 500) {
                        setFormData({ ...formData, description: value });
                      }
                    }}
                    placeholder="Add a brief summary of this workout..."
                    className="w-full px-3 py-2 bg-background-tertiary/50 border border-border/40 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
                    rows={3}
                  />
                  <div className="text-xs text-text-muted mt-1 text-right">
                    {formData.description.length}/500
                  </div>
                </div>

                {/* Tags */}
                {user?.id && (
                  <div className="bg-background-elevated rounded-xl border border-border/60 p-4">
                    <TagManager
                      coachId={user.id}
                      selectedTags={formData.selectedTags}
                      onTagsChange={(tags) => setFormData({ ...formData, selectedTags: tags })}
                    />
                  </div>
                )}

                <WorkoutDescriptionTextarea
                  value={formData.rawDescription}
                  onChange={(value) => setFormData({ ...formData, rawDescription: value })}
                />
              </div>

              {/* Right Column - Analysis & Metrics */}
              <div className="flex flex-col gap-4 lg:w-[420px] xl:w-[480px] lg:overflow-y-auto lg:pl-4">
                <RealtimeWorkoutAnalyzer 
                  workoutText={formData.rawDescription}
                  onAnalysisUpdate={handleAnalysisUpdate}
                  onEditMetric={(metric, currentValue) => {
                    setEditingMetric({ type: metric, value: currentValue });
                  }}
                />
                
                <EffortLevelSlider
                  value={formData.effortLevel}
                  onChange={(value) => setFormData({ ...formData, effortLevel: value })}
                />
              </div>
              
            </div>
          </div>
        </form>
      </div>

      {/* Edit Metric Modal */}
      <EditMetricModal
        isOpen={editingMetric !== null}
        metricType={editingMetric?.type || null}
        initialValue={editingMetric?.value || 0}
        onSave={(value) => {
          if (editingMetric) {
            if (editingMetric.type === 'distance') {
              setFormData(prev => ({ ...prev, totalMeters: value }));
            } else if (editingMetric.type === 'duration') {
              setFormData(prev => ({ ...prev, estimatedTimeMinutes: value }));
            } else if (editingMetric.type === 'calories') {
              setFormData(prev => ({ ...prev, estimatedCalories: value }));
            }
          }
        }}
        onClose={() => setEditingMetric(null)}
      />
    </div>
  );
}
