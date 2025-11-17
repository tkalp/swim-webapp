export interface BestTimes {
  [distance: string]: string // distance (e.g., "50", "100") -> time (e.g., "24.5", "1:23.45")
}

export interface GeneratedWorkout {
  id: string
  prompt: string
  workout: string
  provider: 'claude'
  timestamp: string
  examples: WorkoutExample[]
  athletePaces?: string
}

export interface WorkoutExample {
  id: string
  title: string
  url: string
  relevance: number
}

export interface WorkoutPrompt {
  text: string
  level?: string
  distance?: number
  focus?: string
  poolLength?: string
}