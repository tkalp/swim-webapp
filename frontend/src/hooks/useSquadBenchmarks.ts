import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface SquadBenchmark {
  swimmer_id: string;
  time_seconds: number;
  performed_on: string;
}

export type SquadBenchmarksByEvent = Record<string, SquadBenchmark[]>;

export const useSquadBenchmarks = (squadId: string | undefined, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['squadBenchmarks', squadId],
    queryFn: async (): Promise<SquadBenchmarksByEvent> => {
      if (!squadId) return {};
      return apiClient.get<SquadBenchmarksByEvent>(`/squads/${squadId}/benchmarks`);
    },
    enabled: enabled && !!squadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });
};
