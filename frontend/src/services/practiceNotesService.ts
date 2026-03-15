// services/practiceNotesService.ts
import { apiClient } from '@/lib/apiClient';
import type {
  PrePracticeNote,
  PostPracticeNote,
  CreatePrePracticeNoteData,
  CreatePostPracticeNoteData,
} from '@/types/practiceNotes';

/**
 * Get pre-practice note for a training session
 */
export async function getPrePracticeNote(trainingSessionId: string): Promise<PrePracticeNote | null> {
  const notes = await apiClient.get<PrePracticeNote[]>(`/practice-notes/pre/${trainingSessionId}`);

  // Backend returns an array; return the first note or null
  if (!notes || notes.length === 0) return null;
  return notes[0];
}

/**
 * Get post-practice note for a training session
 */
export async function getPostPracticeNote(trainingSessionId: string): Promise<PostPracticeNote | null> {
  const notes = await apiClient.get<PostPracticeNote[]>(`/practice-notes/post/${trainingSessionId}`);

  // Backend returns an array; return the first note or null
  if (!notes || notes.length === 0) return null;
  return notes[0];
}

/**
 * Create or update pre-practice note.
 * Accepts an optional `id` — when present, issues a PUT (update); otherwise POST (create).
 */
export async function upsertPrePracticeNote(
  data: CreatePrePracticeNoteData & { id?: string }
): Promise<PrePracticeNote> {
  if (data.id) {
    // Update existing note
    const { id, training_session_id, ...updateFields } = data;
    return apiClient.put<PrePracticeNote>(`/practice-notes/pre/${id}`, updateFields);
  }
  // Create new note — backend gets coach_id from JWT
  return apiClient.post<PrePracticeNote>('/practice-notes/pre', data);
}

/**
 * Create or update post-practice note.
 * Accepts an optional `id` — when present, issues a PUT (update); otherwise POST (create).
 */
export async function upsertPostPracticeNote(
  data: CreatePostPracticeNoteData & { id?: string }
): Promise<PostPracticeNote> {
  if (data.id) {
    // Update existing note
    const { id, training_session_id, ...updateFields } = data;
    return apiClient.put<PostPracticeNote>(`/practice-notes/post/${id}`, updateFields);
  }
  // Create new note — backend gets coach_id from JWT
  return apiClient.post<PostPracticeNote>('/practice-notes/post', data);
}

/**
 * Delete pre-practice note
 */
export async function deletePrePracticeNote(id: string): Promise<void> {
  await apiClient.delete(`/practice-notes/pre/${id}`);
}

/**
 * Delete post-practice note
 */
export async function deletePostPracticeNote(id: string): Promise<void> {
  await apiClient.delete(`/practice-notes/post/${id}`);
}
