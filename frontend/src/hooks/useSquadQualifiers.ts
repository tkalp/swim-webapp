import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { getSwimmerBestTimes, type BestTimeResult } from '@/services/workoutResultService';

export type Swimmer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
};

// Query keys for cache management
export const squadQualifiersKeys = {
  all: ['squadQualifiers'] as const,
  squad: (squadId: string) => [...squadQualifiersKeys.all, squadId] as const,
  swimmers: (squadId: string) => [...squadQualifiersKeys.squad(squadId), 'swimmers'] as const,
  bestTimes: (swimmerId: string) => [...squadQualifiersKeys.all, 'bestTimes', swimmerId] as const,
  standards: (setId: string, poolType: string) => [...squadQualifiersKeys.all, 'standards', setId, poolType] as const,
};

export function useSquadSwimmers(squadId: string) {
  return useQuery({
    queryKey: squadQualifiersKeys.swimmers(squadId),
    queryFn: async () => {
      const data = await apiClient.get<Swimmer[]>(`/squads/${squadId}/swimmers`);
      return data || [];
    },
    enabled: !!squadId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useSwimmerBestTimes(swimmerId: string) {
  return useQuery({
    queryKey: squadQualifiersKeys.bestTimes(swimmerId),
    queryFn: () => getSwimmerBestTimes(swimmerId),
    enabled: !!swimmerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTimeStandards(setId: string | null, poolType: string) {
  return useQuery({
    queryKey: squadQualifiersKeys.standards(setId ?? 'none', poolType),
    queryFn: async () => {
      if (!setId) return [];
      const data = await apiClient.get<any[]>(`/time-standards/sets/${setId}/standards`);
      return data || [];
    },
    enabled: !!setId,
    staleTime: 30 * 60 * 1000, // 30 minutes (standards change rarely)
  });
}

// OPTIMIZED: New combined hook for squad qualifiers
export interface SwimmerBestTimeData {
  distance: number;
  stroke: string;
  activity: string;
  equipment: string;
  result_units: string;
  time_seconds: number;
  performed_on: string;
}

export interface SwimmerWithBestTimes {
  swimmer_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  best_times: SwimmerBestTimeData[];
}

export interface SquadQualifiersData {
  swimmers: SwimmerWithBestTimes[];
}

/**
 * OPTIMIZED hook that eliminates the N+1 query problem.
 *
 * Previously:
 * - 1 query for swimmers (direct API call)
 * - N queries for each swimmer's best times (17 swimmers = 17 API calls)
 *
 * Now:
 * - 1 query fetching all swimmers + best times via backend API
 *
 * Performance: 18 requests -> 1 request, ~1800-3600ms -> ~100-200ms
 */
export function useSquadQualifiersOptimized(squadId: string) {
  return useQuery({
    queryKey: [...squadQualifiersKeys.squad(squadId), 'optimized'] as const,
    queryFn: async (): Promise<SquadQualifiersData> => {
      const data = await apiClient.get<SquadQualifiersData>(`/squads/${squadId}/qualifiers`);
      return data;
    },
    enabled: !!squadId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
  });
}
