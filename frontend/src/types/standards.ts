// Time Standards Types

export interface TimeStandardsSet {
  id: string;
  name: string;
  organization: string;
  year: number;
  description?: string;
  active: boolean;
  standards_count?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeStandard {
  id: string;
  set_id: string;
  distance: number;
  stroke: 'free' | 'back' | 'breast' | 'fly' | 'im';
  activity: 'swim' | 'kick' | 'drill' | 'pull';
  equipment: 'none' | 'fins' | 'paddles' | 'snorkel' | 'pull_buoy';
  age_group_min: number;
  age_group_max: number;
  gender: 'M' | 'F' | 'X';
  scm_time?: string; // PostgreSQL interval as string
  lcm_time?: string; // PostgreSQL interval as string
  standard_level: string;
  points?: number;
  created_at: string;
  updated_at: string;
}

export interface TimeStandardInput {
  distance: number;
  stroke: string;
  activity?: string;
  equipment?: string;
  age_group_min: number;
  age_group_max: number;
  gender: string;
  scm_time?: string;
  lcm_time?: string;
  standard_level: string;
  points?: number;
}

export interface SwimmerStandardsTracking {
  id: string;
  swimmer_id: string;
  standard_set_id: string;
  active: boolean;
  created_by: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StandardComparison {
  event_name: string;
  swimmer_time: string;
  standard_time: string;
  difference_seconds: number;
  difference_percentage: number;
  standard_level: string;
  achieved: boolean;
}
