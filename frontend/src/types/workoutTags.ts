// types/workoutTags.ts

export interface WorkoutTag {
  id: string;
  coach_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTagData {
  name: string;
  color: string;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
}

export const TAG_COLORS = [
  { name: 'Red', hex: '#EF4444', light: '#FEE2E2' },
  { name: 'Orange', hex: '#F59E0B', light: '#FEF3C7' },
  { name: 'Yellow', hex: '#EAB308', light: '#FEF9C3' },
  { name: 'Green', hex: '#10B981', light: '#D1FAE5' },
  { name: 'Teal', hex: '#14B8A6', light: '#CCFBF1' },
  { name: 'Blue', hex: '#3B82F6', light: '#DBEAFE' },
  { name: 'Indigo', hex: '#6366F1', light: '#E0E7FF' },
  { name: 'Purple', hex: '#8B5CF6', light: '#EDE9FE' },
  { name: 'Pink', hex: '#EC4899', light: '#FCE7F3' },
  { name: 'Cyan', hex: '#06B6D4', light: '#CFFAFE' },
] as const;
