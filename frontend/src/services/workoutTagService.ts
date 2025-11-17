// services/workoutTagService.ts
import { supabase } from "../lib/supabase";
import type { WorkoutTag, CreateTagData, UpdateTagData } from "../types/workoutTags";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Get all tags for a coach
 */
export async function getCoachTags(coachId: string): Promise<WorkoutTag[]> {
  const { data, error } = await supabase
    .from("workout_tags")
    .select("*")
    .eq("coach_id", coachId)
    .order("name");

  if (error) throw error;
  return data || [];
}

/**
 * Create a new tag
 */
export async function createTag(coachId: string, tagData: CreateTagData): Promise<WorkoutTag> {
  // Check if tag name already exists for this coach
  const { data: existing } = await supabase
    .from("workout_tags")
    .select("id")
    .eq("coach_id", coachId)
    .eq("name", tagData.name)
    .single();

  if (existing) {
    throw new Error("Tag with this name already exists");
  }

  const { data, error } = await supabase
    .from("workout_tags")
    .insert({
      coach_id: coachId,
      name: tagData.name,
      color: tagData.color,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a tag
 */
export async function updateTag(tagId: string, updates: UpdateTagData): Promise<WorkoutTag> {
  const updateData: any = { ...updates, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("workout_tags")
    .update(updateData)
    .eq("id", tagId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase
    .from("workout_tags")
    .delete()
    .eq("id", tagId);

  if (error) throw error;
}

/**
 * Get all tags for a specific workout
 */
export async function getWorkoutTags(workoutId: string): Promise<WorkoutTag[]> {
  const { data, error } = await supabase
    .from("workout_template_tags")
    .select(`
      workout_tags (
        id,
        coach_id,
        name,
        color,
        created_at,
        updated_at
      )
    `)
    .eq("workout_id", workoutId);

  if (error) throw error;
  
  // Extract tags from the nested structure
  const tags = data?.map((item: any) => item.workout_tags).filter(Boolean) || [];
  return tags;
}

/**
 * Add a tag to a workout
 */
export async function addTagToWorkout(workoutId: string, tagId: string): Promise<void> {
  // Check if association already exists
  const { data: existing } = await supabase
    .from("workout_template_tags")
    .select("id")
    .eq("workout_id", workoutId)
    .eq("tag_id", tagId)
    .single();

  if (existing) {
    return; // Already associated
  }

  const { error } = await supabase
    .from("workout_template_tags")
    .insert({
      workout_id: workoutId,
      tag_id: tagId,
    });

  if (error) throw error;
}

/**
 * Remove a tag from a workout
 */
export async function removeTagFromWorkout(workoutId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from("workout_template_tags")
    .delete()
    .eq("workout_id", workoutId)
    .eq("tag_id", tagId);

  if (error) throw error;
}

/**
 * Set all tags for a workout (replace existing)
 */
export async function setWorkoutTags(workoutId: string, tagIds: string[]): Promise<void> {
  // Delete all existing associations
  await supabase
    .from("workout_template_tags")
    .delete()
    .eq("workout_id", workoutId);

  // Insert new associations
  if (tagIds.length > 0) {
    const associations = tagIds.map(tagId => ({
      workout_id: workoutId,
      tag_id: tagId,
    }));

    const { error } = await supabase
      .from("workout_template_tags")
      .insert(associations);

    if (error) throw error;
  }
}
