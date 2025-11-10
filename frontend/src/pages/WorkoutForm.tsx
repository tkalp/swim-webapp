// pages/WorkoutForm.tsx
import { useState } from "react";
import { FileText } from "lucide-react";
import "@/styles/CreateWorkout.css";
import { RealtimeWorkoutAnalyzer } from "../components/workout";
import { useWorkoutForm } from "./WorkoutForm/hooks/useWorkoutForm";
import {
  WorkoutFormHeader,
  ErrorAlert,
  WorkoutNameInput,
  WorkoutDescriptionTextarea,
  EffortLevelSlider,
  EditMetricModal,
} from "./WorkoutForm/components";

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

            <WorkoutDescriptionTextarea
              value={formData.rawDescription}
              onChange={(value) => setFormData({ ...formData, rawDescription: value })}
            />

            <EffortLevelSlider
              value={formData.effortLevel}
              onChange={(value) => setFormData({ ...formData, effortLevel: value })}
            />
          </div>

          {/* Right Panel - Analysis & Metrics */}
          <div className="w-[480px] flex flex-col gap-3 overflow-y-auto pl-2">
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