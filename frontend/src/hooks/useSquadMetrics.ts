import { useQuery, useQueries } from '@tanstack/react-query';
import {
  getSquadAttendanceStats,
  getSquadDistancePerWeek,
  getSquadDistancePerDay,
  getSquadStrokeBreakdown,
  getSquadActivityBreakdown,
  getSquadSessionCount,
  getSquadTotalMeters,
  type StrokeBreakdown,
  type ActivityBreakdown,
  type DayDistance,
} from '@/services/metricsService';

interface DateRange {
  from?: string;
  to?: string;
}

// Query keys for cache management
export const squadMetricsKeys = {
  all: ['squadMetrics'] as const,
  squad: (squadId: string) => [...squadMetricsKeys.all, squadId] as const,
  attendance: (squadId: string, range: DateRange) => 
    [...squadMetricsKeys.squad(squadId), 'attendance', range] as const,
  distancePerWeek: (squadId: string, range: DateRange) => 
    [...squadMetricsKeys.squad(squadId), 'distancePerWeek', range] as const,
  distancePerDay: (squadId: string, range: DateRange) => 
    [...squadMetricsKeys.squad(squadId), 'distancePerDay', range] as const,
  strokeBreakdown: (squadId: string, range: DateRange) => 
    [...squadMetricsKeys.squad(squadId), 'strokeBreakdown', range] as const,
  activityBreakdown: (squadId: string, range: DateRange) => 
    [...squadMetricsKeys.squad(squadId), 'activityBreakdown', range] as const,
  sessionCount: (squadId: string, range: DateRange) => 
    [...squadMetricsKeys.squad(squadId), 'sessionCount', range] as const,
  totalMeters: (squadId: string, range: DateRange) => 
    [...squadMetricsKeys.squad(squadId), 'totalMeters', range] as const,
};

// Individual hooks for each metric
export function useSquadAttendance(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsKeys.attendance(squadId, range),
    queryFn: () => getSquadAttendanceStats(squadId, range),
    enabled: !!squadId,
  });
}

export function useSquadDistancePerWeek(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsKeys.distancePerWeek(squadId, range),
    queryFn: () => getSquadDistancePerWeek(squadId, range),
    enabled: !!squadId,
  });
}

export function useSquadDistancePerDay(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsKeys.distancePerDay(squadId, range),
    queryFn: () => getSquadDistancePerDay(squadId, range),
    enabled: !!squadId,
  });
}

export function useSquadStrokeBreakdown(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsKeys.strokeBreakdown(squadId, range),
    queryFn: () => getSquadStrokeBreakdown(squadId, range),
    enabled: !!squadId,
  });
}

export function useSquadActivityBreakdown(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsKeys.activityBreakdown(squadId, range),
    queryFn: () => getSquadActivityBreakdown(squadId, range),
    enabled: !!squadId,
  });
}

export function useSquadSessionCount(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsKeys.sessionCount(squadId, range),
    queryFn: () => getSquadSessionCount(squadId, range),
    enabled: !!squadId,
  });
}

export function useSquadTotalMeters(squadId: string, range: DateRange) {
  return useQuery({
    queryKey: squadMetricsKeys.totalMeters(squadId, range),
    queryFn: () => getSquadTotalMeters(squadId, range),
    enabled: !!squadId,
  });
}

// Combined hook that fetches all metrics in parallel with automatic deduplication
export function useSquadMetrics(squadId: string, range: DateRange) {
  const results = useQueries({
    queries: [
      {
        queryKey: squadMetricsKeys.attendance(squadId, range),
        queryFn: () => getSquadAttendanceStats(squadId, range),
        enabled: !!squadId,
      },
      {
        queryKey: squadMetricsKeys.distancePerWeek(squadId, range),
        queryFn: () => getSquadDistancePerWeek(squadId, range),
        enabled: !!squadId,
      },
      {
        queryKey: squadMetricsKeys.strokeBreakdown(squadId, range),
        queryFn: () => getSquadStrokeBreakdown(squadId, range),
        enabled: !!squadId,
      },
      {
        queryKey: squadMetricsKeys.activityBreakdown(squadId, range),
        queryFn: () => getSquadActivityBreakdown(squadId, range),
        enabled: !!squadId,
      },
      {
        queryKey: squadMetricsKeys.sessionCount(squadId, range),
        queryFn: () => getSquadSessionCount(squadId, range),
        enabled: !!squadId,
      },
      {
        queryKey: squadMetricsKeys.totalMeters(squadId, range),
        queryFn: () => getSquadTotalMeters(squadId, range),
        enabled: !!squadId,
      },
    ],
  });

  const [
    attendanceQuery,
    distanceQuery,
    strokeQuery,
    activityQuery,
    sessionCountQuery,
    totalMetersQuery,
  ] = results;

  return {
    // Data
    attendance: attendanceQuery.data ?? null,
    distancePerWeek: distanceQuery.data ?? [],
    strokeBreakdown: strokeQuery.data ?? [],
    activityBreakdown: activityQuery.data ?? [],
    sessionCount: sessionCountQuery.data ?? 0,
    totalMeters: totalMetersQuery.data ?? 0,
    
    // Loading states
    isLoading: results.some(q => q.isLoading),
    isFetching: results.some(q => q.isFetching),
    
    // Error handling
    error: results.find(q => q.error)?.error as Error | null,
    
    // Individual query states for granular control
    queries: {
      attendance: attendanceQuery,
      distance: distanceQuery,
      stroke: strokeQuery,
      activity: activityQuery,
      sessionCount: sessionCountQuery,
      totalMeters: totalMetersQuery,
    },
    
    // Refetch function to manually refresh all metrics
    refetchAll: () => Promise.all(results.map(q => q.refetch())),
  };
}
