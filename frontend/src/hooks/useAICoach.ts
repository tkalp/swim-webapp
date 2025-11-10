// hooks/useAICoach.ts
import { useState, useCallback } from 'react'
import { generateWorkout } from '../features/ai-coach/api'
import type { AICoachSettings, GeneratedWorkout, BestTimes } from '../types/ai-coach/types'

export function useAICoach() {
  const [settings, setSettings] = useState<AICoachSettings>({
    provider: 'claude',
    apiKey: '',
    numExamples: 3,
  })

  const anthropicApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string
  const groqApiKey = import.meta.env.VITE_GROQ_KEY as string
  
  if (settings.provider === 'claude' && !settings.apiKey && anthropicApiKey) {
    settings.apiKey = anthropicApiKey
  }
  if (settings.provider === 'groq' && !settings.apiKey && groqApiKey) {
    console.log(groqApiKey)
    settings.apiKey = groqApiKey
  }

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [currentWorkout, setCurrentWorkout] = useState<GeneratedWorkout | null>(null)

  const generate = useCallback(async (prompt: string, bestTimes?: BestTimes) => {
    if (!prompt.trim()) {
      setError('Please enter a workout description')
      return null
    }

    if (!settings.apiKey.trim()) {
      setError('Please enter your API key in settings')
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
        provider: settings.provider,
        apiKey: settings.apiKey,
        numExamples: settings.numExamples,
        bestTimes: Object.keys(filteredBestTimes || {}).length > 0 ? filteredBestTimes : undefined,
      })

      const workout: GeneratedWorkout = {
        id: Date.now().toString(),
        prompt,
        workout: response.workout,
        provider: settings.provider,
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
  }, [settings])

  const updateSettings = useCallback((updates: Partial<AICoachSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const clearError = useCallback(() => setError(''), [])
  const clearWorkout = useCallback(() => setCurrentWorkout(null), [])

  return {
    // State
    settings,
    loading,
    error,
    currentWorkout,

    // Actions
    generate,
    updateSettings,
    clearError,
    clearWorkout,
  }
}