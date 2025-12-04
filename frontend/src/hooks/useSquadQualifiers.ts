import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
      const { data, error } = await supabase
        .from('squad_swimmer')
        .select('swimmer:swimmers(id, first_name, last_name, date_of_birth, sex)')
        .eq('squad_id', squadId);

      if (error) throw error;

      return (data?.map((item: any) => item.swimmer).filter(Boolean) || []) as Swimmer[];
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

      const { data, error } = await supabase
        .from('time_standards')
        .select('distance, stroke, age_group_min, age_group_max, gender, standard_level, scm_time, lcm_time')
        .eq('set_id', setId)
        .order('standard_level', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!setId,
    staleTime: 30 * 60 * 1000, // 30 minutes (standards change rarely)
  });
}
