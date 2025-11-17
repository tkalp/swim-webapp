// hooks/useWorkoutForm.ts
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { createWorkoutForSession, getWorkout, updateWorkout } from "../../../features/workout/api";
import { useAuth } from "../../../contexts/AuthContext";

export type WorkoutFormData = {
  name: string;
  rawDescription: string;
  totalMeters: number;
  estimatedTimeMinutes: number;
  estimatedCalories: number;
  effortLevel: number;
  jsonDescription: string | null;
};

export function useWorkoutForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workoutId } = useParams<{ workoutId: string }>();
  
  const isEditMode = !!workoutId;
  const sessionId = searchParams.get("sessionId");

  const [formData, setFormData] = useState<WorkoutFormData>({
    name: "",
    rawDescription: "",
    totalMeters: 0,
    estimatedTimeMinutes: 0,
    estimatedCalories: 0,
    effortLevel: 5,
    jsonDescription: null,
  });

  const [loading, setLoading] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(isEditMode);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // Load existing workout data if in edit mode
  useEffect(() => {
    if (!workoutId) return;
    
    let mounted = true;
    (async () => {
      try {
        setLoadingWorkout(true);
        const workout = await getWorkout(workoutId);
        if (!mounted) return;
        
        setFormData({
          name: workout.name ?? "",
          rawDescription: workout.raw_description ?? "",
          totalMeters: workout.total_meters ?? 0,
          estimatedTimeMinutes: workout.estimated_time_minutes ?? 0,
          estimatedCalories: workout.estimated_calories ?? 0,
          effortLevel: workout.effort_level ?? 5,
          jsonDescription: workout.json_description ? JSON.stringify(workout.json_description) : null,
        });
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to load workout");
        }
      } finally {
        if (mounted) {
          setLoadingWorkout(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [workoutId]);

  // Handle analysis updates from RealtimeWorkoutAnalyzer
  const handleAnalysisUpdate = useCallback((jsonDescription: string | null) => {
    if (jsonDescription) {
      try {
        const parsed = JSON.parse(jsonDescription);
        setAnalysisData(parsed);
        
        setFormData(prev => ({
          ...prev,
          jsonDescription,
          totalMeters: parsed.estimate?.totalDistance || prev.totalMeters,
          estimatedTimeMinutes: Math.round(parsed.estimate?.totalMinutes || prev.estimatedTimeMinutes),
          estimatedCalories: parsed.estimate?.estimatedCalories || prev.estimatedCalories,
        }));
      } catch (e) {
        setFormData(prev => ({
          ...prev,
          jsonDescription
        }));
      }
    } else {
      setAnalysisData(null);
      setFormData(prev => ({
        ...prev,
        jsonDescription
      }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isEditMode && workoutId) {
        const updatedWorkout = {
          name: formData.name,
          raw_description: formData.rawDescription,
          total_meters: formData.totalMeters,
          estimated_time_minutes: formData.estimatedTimeMinutes,
          estimated_calories: formData.estimatedCalories,
          effort_level: formData.effortLevel,
          json_description: formData.jsonDescription ? JSON.parse(formData.jsonDescription) : null,
        };

        await updateWorkout(workoutId, updatedWorkout);
      } else {
        const newWorkout = {
          name: formData.name,
          description: formData.rawDescription,
          total_meters: formData.totalMeters,
          estimated_time_minutes: formData.estimatedTimeMinutes,
          estimated_calories: formData.estimatedCalories,
          effort_level: formData.effortLevel,
          create_by_coach: user?.id || "",
          json_description: formData.jsonDescription ? JSON.parse(formData.jsonDescription) : null,
        };
        

        await createWorkoutForSession(newWorkout, sessionId || "");
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (err: any) {
      setError(err.message || `Failed to ${isEditMode ? 'update' : 'create'} workout`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (confirm("Are you sure? Your changes will be lost.")) {
      navigate(-1);
    }
  };

  const isValid = !!(formData.name.trim() && formData.rawDescription.trim());

  return {
    formData,
    setFormData,
    loading,
    loadingWorkout,
    error,
    setError,
    success,
    analysisData,
    isEditMode,
    isValid,
    handleSubmit,
    handleCancel,
    handleAnalysisUpdate,
  };
}
