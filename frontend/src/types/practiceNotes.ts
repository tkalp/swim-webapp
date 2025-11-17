// types/practiceNotes.ts

export interface PrePracticeNote {
  id: string;
  training_session_id: string;
  coach_id: string;
  announcements?: string;
  reminders?: string;
  focus?: string;
  equipment_needed?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PostPracticeNote {
  id: string;
  training_session_id: string;
  coach_id: string;
  overall_rating?: number; // 1-5
  effort_level?: number; // 1-5
  technique_quality?: number; // 1-5
  positivity?: number; // 1-5
  what_went_well?: string;
  areas_for_improvement?: string;
  next_session_focus?: string;
  individual_highlights?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePrePracticeNoteData {
  training_session_id: string;
  announcements?: string;
  reminders?: string;
  focus?: string;
  equipment_needed?: string;
  notes?: string;
}

export interface CreatePostPracticeNoteData {
  training_session_id: string;
  overall_rating?: number;
  effort_level?: number;
  technique_quality?: number;
  positivity?: number;
  what_went_well?: string;
  areas_for_improvement?: string;
  next_session_focus?: string;
  individual_highlights?: string;
  notes?: string;
}

export type UpdatePrePracticeNoteData = Partial<Omit<CreatePrePracticeNoteData, 'training_session_id'>>;
export type UpdatePostPracticeNoteData = Partial<Omit<CreatePostPracticeNoteData, 'training_session_id'>>;
