// features/ai-coach/api.ts

import type { BestTimes } from "../../types/ai-coach/types"

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface GenerateWorkoutRequest {
  prompt: string
  provider: 'claude' | 'openai' | 'groq'
  apiKey: string
  numExamples?: number
  bestTimes?: BestTimes
}

export interface ExampleWorkout {
  id: string
  title: string
  url: string
  relevance: number
}

export interface GenerateWorkoutResponse {
  workout: string
  examples: ExampleWorkout[]
  athlete_paces?: string
}

/**
 * Generate a swimming workout using AI Coach
 */
export async function generateWorkout(
  request: GenerateWorkoutRequest
): Promise<GenerateWorkoutResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai-coach/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: request.prompt,
      provider: request.provider,
      apiKey: request.apiKey,
      numExamples: request.numExamples ?? 3,
      bestTimes: request.bestTimes,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      detail: 'Failed to generate workout' 
    }))
    // FastAPI returns errors in 'detail' field
    throw new Error(error.detail || error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Check AI Coach health status
 */
export async function checkAICoachHealth(): Promise<{
  status: string
  chromadb?: string
  message?: string
}> {
  const response = await fetch(`${API_BASE_URL}/api/ai-coach/health`)
  return response.json()
}

/**
 * Check general API health
 */
export async function checkAPIHealth(): Promise<{
  status: string
  message: string
}> {
  const response = await fetch(`${API_BASE_URL}/health`)
  return response.json()
}

// Quick templates for common workout types
export const WORKOUT_TEMPLATES = [
  {
    id: 'sprint',
    name: 'Sprint Training',
    prompt: 'Generate a 3000 yard sprint workout for advanced swimmers. Include short, fast intervals with adequate rest. Focus on explosive starts and maximum velocity.',
  },
  {
    id: 'endurance',
    name: 'Endurance Base',
    prompt: 'Create an endurance workout for building aerobic base. Include longer sets at moderate pace with emphasis on consistent tempo and breathing patterns. Total: 4000 yards.',
  },
  {
    id: 'im',
    name: 'IM Practice',
    prompt: 'Design an IM-focused workout with all four strokes. Include stroke-specific drills, IM combinations, and proper transitions. Total: 3500 yards.',
  },
  {
    id: 'race',
    name: 'Race Prep',
    prompt: 'Race simulation workout for 200 freestyle. Include pace work, broken swims at race pace, and mental preparation elements. Total: 3000 yards.',
  },
] as const

export type TemplateId = typeof WORKOUT_TEMPLATES[number]['id']