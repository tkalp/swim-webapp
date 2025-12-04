import { useQuery } from '@tanstack/react-query';
import { 
  getSquadAttendanceRankings,
  type SquadAttendanceData 
} from '@/services/attendanceService';

// Query keys for cache management
export const squadAttendanceKeys = {
  all: ['squadAttendance'] as const,
  squad: (squadId: string) => [...squadAttendanceKeys.all, squadId] as const,
  rankings: (squadId: string, startDate: string, endDate: string) => 
    [...squadAttendanceKeys.squad(squadId), 'rankings', startDate, endDate] as const,
};

export function useSquadAttendance(
  squadId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: squadAttendanceKeys.rankings(squadId, startDate, endDate),
    queryFn: () => getSquadAttendanceRankings(squadId, startDate, endDate),
    enabled: !!squadId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
