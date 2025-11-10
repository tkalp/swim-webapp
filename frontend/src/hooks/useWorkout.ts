import { useState } from "react";
import { getWorkout } from "../features/workout/api";

export type Workout = {
  id: string;
  name: string;
  totalMeters: number;
  estimatedTimeMinutes: number;
  estimatedCalories: number;
  effortLevel: number;
  rawDescription: string;
  jsonDescription?: any;
  createdAt: string;
  createByCoach: string;
};

function convertToWorkout(data: any): Workout {
  return {
    id: data.id,
    name: data.name,
    totalMeters: data.total_meters,
    estimatedTimeMinutes: data.estimated_time_minutes,
    estimatedCalories: data.estimated_calories,
    effortLevel: data.effort_level,
    rawDescription: data.raw_description,
    jsonDescription: data.json_description,
    createdAt: data.created_at,
    createByCoach: data.create_by_coach,
    };
}


export default function useWorkout() {
  // Placeholder for workout-related logic
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkout = async (id: string) => {
    try {
      setWorkoutLoading(true);
      const workout = await getWorkout(id);
      console.log("Fetched workout:", workout);
    
      // Convert to Workout type
      const convertedWorkout = convertToWorkout(workout);

      setWorkout(convertedWorkout);
      setWorkoutLoading(false);

      return convertedWorkout;
    } catch (error) {
      console.error("Failed to fetch workout:", error);
      setError("Failed to fetch workout");
      setWorkoutLoading(false);
    }
  };

  return { workout, setWorkout, fetchWorkout, workoutLoading };
}
