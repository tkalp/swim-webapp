// pages/WorkoutForm.tsx
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
      <div className="create-workout-page">
        <div className="create-workout-header">
          <div className="create-workout-header-content">
            <button className="back-link" onClick={handleCancel}>
              <span>Cancel</span>
            </button>
            <div className="header-main">
              <div className="header-icon">
                <FileText size={28} />
              </div>
              <div>
                <h1 className="header-title">Loading Workout...</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading workout data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background-primary flex flex-col overflow-hidden">
      {/* Header */}
      <WorkoutFormHeader
        isEditMode={isEditMode}
        isValid={isValid}
        loading={loading}
        success={success}
        onCancel={handleCancel}
      />

      {/* Error Alert */}
      <ErrorAlert error={error} onDismiss={() => setError("")} />

      {/* Form - Split Screen Layout */}
      <form id="workout-form" className="flex-1 flex overflow-hidden min-h-0" onSubmit={handleSubmit}>
        <div className="flex-1 flex gap-4 p-4 max-w-[1800px] mx-auto w-full overflow-hidden">
          
          {/* Left Panel - Workout Details */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-2">
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

          {/* Right Panel - Analysis & Metrics - Collapsible on mobile, side panel on desktop */}
          <div className="w-full md:w-[360px] lg:w-[400px] xl:w-[480px] flex flex-col gap-2 md:gap-3 overflow-y-auto md:pl-2 max-h-[400px] md:max-h-none">
            <div className="flex-1 min-h-0">
              <RealtimeWorkoutAnalyzer 
                workoutText={formData.rawDescription}
                className="h-full"
                onAnalysisUpdate={handleAnalysisUpdate}
                onEditMetric={(metric, currentValue) => {
                  setEditingMetric({ type: metric, value: currentValue });
                }}
              />
            </div>
            
            {/* Effort Level - Below Analysis */}
            <EffortLevelSlider
              value={formData.effortLevel}
              onChange={(value) => setFormData({ ...formData, effortLevel: value })}
            />
          </div>
        </div>
      </form>

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