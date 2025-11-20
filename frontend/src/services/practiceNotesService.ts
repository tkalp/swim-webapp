// services/practiceNotesService.ts
import { supabase } from '@/lib/supabase';
import type {
  PrePracticeNote,
  PostPracticeNote,
  CreatePrePracticeNoteData,
  CreatePostPracticeNoteData,
  UpdatePrePracticeNoteData,
  UpdatePostPracticeNoteData,
} from '@/types/practiceNotes';

/**
 * Get pre-practice note for a training session
 */
export async function getPrePracticeNote(trainingSessionId: string): Promise<PrePracticeNote | null> {
  const { data, error } = await supabase
    .from("training_session_pre_practice_notes")
    .select("*")
    .eq("training_session_id", trainingSessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - this is fine
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get post-practice note for a training session
 */
export async function getPostPracticeNote(trainingSessionId: string): Promise<PostPracticeNote | null> {
  const { data, error } = await supabase
    .from("training_session_post_practice_notes")
    .select("*")
    .eq("training_session_id", trainingSessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - this is fine
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create or update pre-practice note
 */
export async function upsertPrePracticeNote(
  data: CreatePrePracticeNoteData
): Promise<PrePracticeNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase
    .from("training_session_pre_practice_notes")
    .upsert({
      ...data,
      coach_id: user.id,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'training_session_id'
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result;
}

/**
 * Create or update post-practice note
 */
export async function upsertPostPracticeNote(
  data: CreatePostPracticeNoteData
): Promise<PostPracticeNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: result, error } = await supabase
    .from("training_session_post_practice_notes")
    .upsert({
      ...data,
      coach_id: user.id,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'training_session_id'
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return result;
}

/**
 * Delete pre-practice note
 */
export async function deletePrePracticeNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("training_session_pre_practice_notes")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Delete post-practice note
 */
export async function deletePostPracticeNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("training_session_post_practice_notes")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
