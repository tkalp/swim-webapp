import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getSquadPerformance, 
  SquadPerformanceData,
  SwimmerPerformance,
  formatTimeFromSeconds 
} from '@/services/metricsService';
import { SquadSummaryStats } from '@/components/squad-analytics/SquadSummaryStats';
import { ArrowLeft, Calendar, Loader2, TrendingDown, TrendingUp, Trophy } from 'lucide-react';

export const SquadPerformance: React.FC = () => {
  const { squadId } = useParams<{ squadId: string }>();
  const navigate = useNavigate();

  // Default to last 90 days
  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [data, setData] = useState<SquadPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSwimmer, setExpandedSwimmer] = useState<string | null>(null);

  // Fetch performance data
  useEffect(() => {
    const fetchData = async () => {
      if (!squadId) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getSquadPerformance(
          squadId,
          dateRange.start,
          dateRange.end
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [squadId, dateRange]);

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const toggleSwimmerExpanded = (swimmerId: string) => {
    setExpandedSwimmer(prev => prev === swimmerId ? null : swimmerId);
  };

  if (!squadId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Invalid squad ID</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/squads/${squadId}`)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {data?.squad.name || 'Loading...'}
                </h1>
                <p className="text-sm text-gray-400">Performance Analytics</p>
              </div>
            </div>

            {/* Date range picker */}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary stats */}
            <SquadSummaryStats summary={data.summary} />

            {/* Performance Table */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">Swimmer Performance Breakdown</h2>
                <p className="text-sm text-gray-400 mt-1">Click on a swimmer to view event details</p>
              </div>

              {data.swimmers.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-400">
                    No performance data available for the selected date range.
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Try adjusting the date range or ensure swimmers have logged workouts.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-750">
                      <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="px-6 py-3">Swimmer</th>
                        <th className="px-6 py-3 text-center">Workouts</th>
                        <th className="px-6 py-3 text-center">Events</th>
                        <th className="px-6 py-3 text-center">PRs</th>
                        <th className="px-6 py-3 text-center">Avg Improvement</th>
                        <th className="px-6 py-3 text-center">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {data.swimmers.map((swimmer) => {
                        const isExpanded = expandedSwimmer === swimmer.swimmer_id;
                        const isImproving = swimmer.avg_improvement_pct < 0;  // Negative = faster times
                        
                        return (
                          <React.Fragment key={swimmer.swimmer_id}>
                            {/* Main row */}
                            <tr 
                              className="hover:bg-gray-750 cursor-pointer transition-colors"
                              onClick={() => toggleSwimmerExpanded(swimmer.swimmer_id)}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
                                    <span className="text-cyan-400 font-semibold text-sm">
                                      {swimmer.swimmer_name.split(' ').map(n => n[0]).join('')}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-white">{swimmer.swimmer_name}</div>
                                    <div className="text-xs text-gray-400">
                                      {isExpanded ? 'Hide' : 'View'} event breakdown
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center text-gray-300">
                                {swimmer.total_workouts}
                              </td>
                              <td className="px-6 py-4 text-center text-gray-300">
                                {swimmer.events_analyzed}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Trophy className="w-4 h-4 text-yellow-400" />
                                  <span className="text-yellow-400 font-semibold">
                                    {swimmer.personal_records}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`font-semibold ${
                                  isImproving ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {swimmer.avg_improvement_pct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {isImproving ? (
                                  <TrendingDown className="w-5 h-5 text-green-400 mx-auto" />
                                ) : (
                                  <TrendingUp className="w-5 h-5 text-gray-400 mx-auto" />
                                )}
                              </td>
                            </tr>

                            {/* Expanded event details */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="px-6 py-4 bg-gray-900">
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                      Event Performance Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {swimmer.events.map((event, idx) => {
                                        const eventImprovement = event.improvement_pct;
                                        const eventImproving = eventImprovement < 0;
                                        
                                        return (
                                          <div 
                                            key={idx}
                                            className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                                          >
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex-1">
                                                <h5 className="font-medium text-white text-sm mb-1">
                                                  {event.event.replace(/_/g, ' ')}
                                                </h5>
                                                <div className="text-xs text-gray-400">
                                                  {event.attempts} attempts
                                                </div>
                                              </div>
                                              {event.personal_records > 0 && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 rounded text-yellow-400 text-xs">
                                                  <Trophy className="w-3 h-3" />
                                                  {event.personal_records}
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className="space-y-2 text-xs">
                                              <div className="flex justify-between">
                                                <span className="text-gray-400">First:</span>
                                                <span className="text-gray-300 font-mono">
                                                  {formatTimeFromSeconds(event.first_time)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-gray-400">Best:</span>
                                                <span className="text-cyan-400 font-mono font-semibold">
                                                  {formatTimeFromSeconds(event.best_time)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-gray-400">Latest:</span>
                                                <span className="text-gray-300 font-mono">
                                                  {formatTimeFromSeconds(event.latest_time)}
                                                </span>
                                              </div>
                                              <div className="pt-2 border-t border-gray-700">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-gray-400">Change:</span>
                                                  <div className="flex items-center gap-1">
                                                    {eventImproving ? (
                                                      <TrendingDown className="w-3 h-3 text-green-400" />
                                                    ) : (
                                                      <TrendingUp className="w-3 h-3 text-red-400" />
                                                    )}
                                                    <span className={`font-semibold ${
                                                      eventImproving ? 'text-green-400' : 'text-red-400'
                                                    }`}>
                                                      {eventImproving ? '' : '+'}{eventImprovement.toFixed(1)}%
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
