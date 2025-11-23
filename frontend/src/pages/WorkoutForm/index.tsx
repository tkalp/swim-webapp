// WorkoutForm/index.tsx
import { useState } from "react";
import { FileText } from "lucide-react";
import { RealtimeWorkoutAnalyzer } from '@/components/workout';
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

      {/* Form - Responsive Layout: Stacked on mobile, split-screen on desktop */}
      <form id="workout-form" className="flex-1 flex overflow-hidden min-h-0" onSubmit={handleSubmit}>
        <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-3 lg:gap-4 p-2 md:p-3 lg:p-4 max-w-[1800px] mx-auto w-full overflow-hidden">
          
          {/* Left Panel - Workout Details */}
          <div className="flex-1 flex flex-col gap-2 md:gap-3 min-w-0 overflow-y-auto md:pr-2">
            <WorkoutNameInput
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              autoFocus
            />

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
