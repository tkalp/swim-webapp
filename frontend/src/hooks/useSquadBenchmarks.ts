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

      console.log(`==== useSquadBenchmarks called ====`);
      console.log(`Input squadId parameter:`, squadId);
      console.log(`Fetching from URL: /squads/${squadId}/benchmarks`);
      
      const benchmarks = await apiClient.get<SquadBenchmarksByEvent>(`/squads/${squadId}/benchmarks`);
      
      console.log(`==== Backend Response ====`);
      console.log(`Full benchmarks object:`, benchmarks);
      console.log(`Number of events:`, Object.keys(benchmarks).length);
      console.log(`Event keys:`, Object.keys(benchmarks));
      
      // Log sample events for debugging
      const sampleEvents = Object.keys(benchmarks).slice(0, 3);
      sampleEvents.forEach(eventKey => {
        const swimmers = benchmarks[eventKey];
        console.log(`  ${eventKey}: ${swimmers.length} swimmers`, swimmers);
        console.log(`  Swimmer IDs in ${eventKey}:`, swimmers.map((s: any) => s.swimmer_id));
      });
      
      // Check if target swimmer is in ANY event
      const targetSwimmerId = '7c8fccee-b0c1-41ab-a22a-dbae85e62857';
      const eventsWithTarget = Object.keys(benchmarks).filter(eventKey => 
        benchmarks[eventKey].some((s: any) => s.swimmer_id === targetSwimmerId)
      );
      console.log(`Kazeo Lee (${targetSwimmerId}) found in ${eventsWithTarget.length} events:`, eventsWithTarget);

      return benchmarks;
    },
    enabled: enabled && !!squadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });
};
