import { useQuery } from '@tanstack/react-query';
import { 
  getSquadRankings, 
  getAvailableDistances,
  type StrokeType, 
  type ActivityType,
  type SwimmerRanking 
} from '@/services/workoutResultService';

// Query keys for cache management
export const squadRankingsKeys = {
  all: ['squadRankings'] as const,
  squad: (squadId: string) => [...squadRankingsKeys.all, squadId] as const,
  distances: (squadId: string, stroke: StrokeType, activity: ActivityType, course: string) => 
    [...squadRankingsKeys.squad(squadId), 'distances', stroke, activity, course] as const,
  rankings: (squadId: string, stroke: StrokeType, activity: ActivityType, distance: number, course: string) => 
    [...squadRankingsKeys.squad(squadId), 'rankings', stroke, activity, distance, course] as const,
};

export function useAvailableDistances(
  squadId: string, 
  stroke: StrokeType, 
  activity: ActivityType, 
  course: string
) {
  return useQuery({
    queryKey: squadRankingsKeys.distances(squadId, stroke, activity, course),
    queryFn: () => getAvailableDistances(squadId, stroke, activity, course),
    enabled: !!squadId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSquadRankings(
  squadId: string,
  stroke: StrokeType,
  activity: ActivityType,
  distance: number | null,
  course: string
) {
  return useQuery({
    queryKey: squadRankingsKeys.rankings(squadId, stroke, activity, distance ?? 0, course),
    queryFn: () => getSquadRankings(squadId, stroke, activity, distance!, course),
    enabled: !!squadId && distance !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
