import { useQuery } from '@tanstack/react-query'
import { getSquadPredictions, SquadPredictionsResponse } from '../services/workoutResultService'

/**
 * Hook to fetch improvement predictions for all swimmers in a squad
 */
export function useSquadPredictions(
  squadId: string | undefined,
  enabled: boolean = true,
  attemptsUntilTarget: number = 3,
  minAttempts: number = 3
) {
  return useQuery<SquadPredictionsResponse>({
    queryKey: ['squad-predictions', squadId, attemptsUntilTarget, minAttempts],
    queryFn: () => {
      if (!squadId) {
        throw new Error('Squad ID is required')
      }
      return getSquadPredictions(squadId, attemptsUntilTarget, minAttempts)
    },
    enabled: enabled && !!squadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  })
}
