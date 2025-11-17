// hooks/useWorkoutForm.ts
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { createWorkoutForSession, getWorkout, updateWorkout } from "../../../features/workout/api";
import { useAuth } from "../../../contexts/AuthContext";
import { getWorkoutTags, setWorkoutTags } from "../../../services/workoutTagService";
import type { WorkoutTag } from "../../../types/workoutTags";

export type WorkoutFormData = {
  name: string;
  description: string;
  rawDescription: string;
  totalMeters: number;
  estimatedTimeMinutes: number;
  estimatedCalories: number;
  effortLevel: number;
  jsonDescription: string | null;
  selectedTags: WorkoutTag[];
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
    description: "",
    rawDescription: "",
    totalMeters: 0,
    estimatedTimeMinutes: 0,
    estimatedCalories: 0,
    effortLevel: 5,
    jsonDescription: null,
    selectedTags: [],
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
        
        // Load tags for this workout
        let tags: WorkoutTag[] = [];
        try {
          tags = await getWorkoutTags(workoutId);
        } catch (e) {
          console.error("Failed to load workout tags:", e);
        }
        
        setFormData({
          name: workout.name ?? "",
          description: workout.description ?? "",
          rawDescription: workout.raw_description ?? "",
          totalMeters: workout.total_meters ?? 0,
          estimatedTimeMinutes: workout.estimated_time_minutes ?? 0,
          estimatedCalories: workout.estimated_calories ?? 0,
          effortLevel: workout.effort_level ?? 5,
          jsonDescription: workout.json_description ? JSON.stringify(workout.json_description) : null,
          selectedTags: tags,
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
          description: formData.description,
          raw_description: formData.rawDescription,
          total_meters: formData.totalMeters,
          estimated_time_minutes: formData.estimatedTimeMinutes,
          estimated_calories: formData.estimatedCalories,
          effort_level: formData.effortLevel,
          json_description: formData.jsonDescription ? JSON.parse(formData.jsonDescription) : null,
        };

        await updateWorkout(workoutId, updatedWorkout);
        
        // Save tags
        try {
          const tagIds = formData.selectedTags.map(tag => tag.id);
          await setWorkoutTags(workoutId, tagIds);
        } catch (tagError) {
          console.error("Failed to save tags:", tagError);
          // Don't fail the whole operation if tags fail
        }
      } else {
        const newWorkout = {
          name: formData.name,
          description: formData.description || formData.rawDescription.slice(0, 500),
          raw_description: formData.rawDescription,
          total_meters: formData.totalMeters,
          estimated_time_minutes: formData.estimatedTimeMinutes,
          estimated_calories: formData.estimatedCalories,
          effort_level: formData.effortLevel,
          create_by_coach: user?.id || "",
          json_description: formData.jsonDescription ? JSON.parse(formData.jsonDescription) : null,
        };
        

        const result = await createWorkoutForSession(newWorkout, sessionId || "");
        
        // Save tags for the newly created workout
        if (result?.id && formData.selectedTags.length > 0) {
          try {
            const tagIds = formData.selectedTags.map(tag => tag.id);
            await setWorkoutTags(result.id, tagIds);
          } catch (tagError) {
            console.error("Failed to save tags:", tagError);
            // Don't fail the whole operation if tags fail
          }
        }
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
