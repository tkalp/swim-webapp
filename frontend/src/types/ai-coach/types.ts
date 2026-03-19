// ─── Conversation types (new) ───────────────────────────────────

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'coach' | 'assistant';
  content: string;
  metadata: MessageMetadata | null;
  created_at: string;
}

export interface MessageMetadata {
  kickoff_params?: KickoffParams;
  sections?: WorkoutSections;
  edited_sections?: WorkoutSections;
  saved_workout_id?: string;
  saved_workout_title?: string;
}

export interface KickoffParams {
  training_focus?: string;
  target_distance?: number;
  level?: string;
  stroke_emphasis?: string;
}

export interface WorkoutSections {
  warmup?: string;
  preset?: string;
  main?: string;
  cooldown?: string;
  raw?: string;
}

// ─── Legacy types (kept for backward compatibility) ─────────────

export interface BestTimes {
  [distance: string]: string;
}

export interface GeneratedWorkout {
  id: string;
  prompt: string;
  workout: string;
  provider: 'claude';
  timestamp: string;
  examples: WorkoutExample[];
  athletePaces?: string;
}

export interface WorkoutExample {
  id: string;
  title: string;
  url: string;
  relevance: number;
}

export interface WorkoutPrompt {
  text: string;
  level?: string;
  distance?: number;
  focus?: string;
  poolLength?: string;
}
