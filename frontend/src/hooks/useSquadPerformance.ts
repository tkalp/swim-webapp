import { useQuery } from '@tanstack/react-query';
import { 
  getSquadPerformance,
  type SquadPerformanceData 
} from '@/services/metricsService';

// Query keys for cache management
export const squadPerformanceKeys = {
  all: ['squadPerformance'] as const,
  squad: (squadId: string) => [...squadPerformanceKeys.all, squadId] as const,
  data: (squadId: string, startDate: string, endDate: string) => 
    [...squadPerformanceKeys.squad(squadId), 'data', startDate, endDate] as const,
};

export function useSquadPerformance(
  squadId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: squadPerformanceKeys.data(squadId, startDate, endDate),
    queryFn: () => getSquadPerformance(squadId, startDate, endDate),
    enabled: !!squadId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
