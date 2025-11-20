// hooks/useAICoach.ts
import { useState, useCallback } from 'react'
import { generateWorkout } from '@/services/aiCoachService'
import type { GeneratedWorkout, BestTimes } from '@/types/ai-coach/types'

export function useAICoach() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [currentWorkout, setCurrentWorkout] = useState<GeneratedWorkout | null>(null)

  const generate = useCallback(async (prompt: string, bestTimes?: BestTimes) => {
    if (!prompt.trim()) {
      setError('Please enter a workout description')
      return null
    }

    setLoading(true)
    setError('')

    try {
      // Filter out empty times
      const filteredBestTimes = bestTimes 
        ? Object.fromEntries(
            Object.entries(bestTimes).filter(([_, time]) => time.trim() !== '')
          )
        : undefined

      const response = await generateWorkout({
        prompt,
        bestTimes: Object.keys(filteredBestTimes || {}).length > 0 ? filteredBestTimes : undefined,
      })

      const workout: GeneratedWorkout = {
        id: Date.now().toString(),
        prompt,
        workout: response.workout,
        provider: 'claude',
        timestamp: new Date().toISOString(),
        examples: response.examples,
        athletePaces: response.athlete_paces,
      }

      setCurrentWorkout(workout)
      return workout
    } catch (err: any) {
      const message = err.message || 'Failed to generate workout'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => setError(''), [])
  const clearWorkout = useCallback(() => setCurrentWorkout(null), [])

  return {
    // State
    loading,
    error,
    currentWorkout,

    // Actions
    generate,
    clearError,
    clearWorkout,
  }
}