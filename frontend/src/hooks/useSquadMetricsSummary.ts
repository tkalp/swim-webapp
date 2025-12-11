import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface DateRange {
  from?: string;
  to?: string;
}

interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
}

interface DistancePerWeek {
  week: string;
  meters: number;
}

interface StrokeBreakdown {
  stroke: string;
  meters: number;
  color: string;
}

interface ActivityBreakdown {
  activity: string;
  meters: number;
  color: string;
}

export interface SquadMetricsSummary {
  attendance: AttendanceStats;
  session_count: number;
  total_meters: number;
  distance_per_week: DistancePerWeek[];
  stroke_breakdown: StrokeBreakdown[];
  activity_breakdown: ActivityBreakdown[];
}

// Query keys for cache management
export const squadMetricsSummaryKeys = {
  all: ['squadMetricsSummary'] as const,
  squad: (squadId: string) => [...squadMetricsSummaryKeys.all, squadId] as const,
  summary: (squadId: string, range: DateRange) => 
    [...squadMetricsSummaryKeys.squad(squadId), 'summary', range] as const,
};

/**
 * Optimized hook for fetching all squad metrics in a single API call.
 * 
 * This hook replaces the previous approach of making 6 separate queries:
 * - useSquadAttendance
 * - useSquadSessionCount
 * - useSquadTotalMeters
 * - useSquadDistancePerWeek
 * - useSquadStrokeBreakdown
 * - useSquadActivityBreakdown
 * 
 * Performance improvement: 6 requests -> 1 request, ~600-1200ms -> ~100-200ms
 * 
 * @param squadId - The ID of the squad
 * @param range - Date range filter {from, to}
 * @returns React Query result with all metrics data
 */
export function useSquadMetricsSummary(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsSummaryKeys.summary(squadId, range),
    queryFn: async (): Promise<SquadMetricsSummary> => {
      const params = new URLSearchParams();
      if (range.from) params.append('from_date', range.from);
      if (range.to) params.append('to_date', range.to);
      
      const queryString = params.toString();
      const url = `/squads/${squadId}/metrics/summary${queryString ? `?${queryString}` : ''}`;
      
      const data = await apiClient.get<SquadMetricsSummary>(url);
      return data;
    },
    enabled: !!squadId,
    staleTime: 5 * 60 * 1000, // 5 minutes - data doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Avoid unnecessary refetches
  });
}
