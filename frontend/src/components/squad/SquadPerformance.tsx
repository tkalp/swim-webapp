import React, { useState, useEffect } from 'react';
import { 
  getSquadPerformance, 
  SquadPerformanceData,
  formatTimeFromSeconds 
} from '../../features/squads/metricsApi';
import { SquadSummaryStats } from '../squad-analytics/SquadSummaryStats';
import DateInput from '../ui/DateInput';
import { Loader2, TrendingDown, TrendingUp, Trophy } from 'lucide-react';

interface SquadPerformanceTabProps {
  squadId: string;
}

const SquadPerformanceTab: React.FC<SquadPerformanceTabProps> = ({ squadId }) => {
  // Default to Sept 1 of current year to end of current year
  const getDefaultDateRange = () => {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), 8, 1); // Sept 1 (month is 0-indexed)
    
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

  // Format event key to readable name with course type
  const formatEventName = (eventKey: string): string => {
    // Event key format: "{distance}{units}_{stroke}_{activity}_{result_units}_{equipment}"
    // Example: "100M_freestyle_swim_SCM" or "200M_butterfly_swim_LCM_fins"
    const parts = eventKey.split('_');
    const distance = parts[0]; // e.g., "100M"
    let stroke = parts[1]?.charAt(0).toUpperCase() + parts[1]?.slice(1) || ''; // e.g., "Freestyle"
    
    // Special case for IM - make it all caps
    if (parts[1]?.toLowerCase() === 'im') {
      stroke = 'IM';
    }
    
    const courseType = parts[3] || 'SCM'; // e.g., "SCM" or "LCM"
    const equipment = parts[4] ? ` (${parts[4]})` : ''; // e.g., " (fins)"
    
    return `${distance} ${stroke} (${courseType})${equipment}`;
  };

  // Get activity badge styles
  const getActivityBadgeStyles = (activity?: string): string => {
    const act = (activity ?? '').toLowerCase();
    if (act === 'kick') return 'bg-gradient-to-br from-warning/20 to-warning/10 border border-warning/40 text-warning';
    if (act === 'pull') return 'bg-gradient-to-br from-success/20 to-success/10 border border-success/40 text-success';
    return 'bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/40 text-primary';
  };

  // Format activity label
  const formatActivity = (activity?: string): string => {
    const act = (activity ?? '').toLowerCase();
    if (act === 'kick') return 'Kick';
    if (act === 'pull') return 'Pull';
    return 'Swim';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Date range picker */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Performance Analytics</h2>
            <p className="text-sm text-text-secondary mt-1">Track improvement trends across your squad</p>
          </div>
          <div className="flex items-center gap-3">
            <DateInput
              value={dateRange.start}
              onChange={(value) => handleDateChange('start', value)}
              placeholder="Start date"
            />
            <span className="text-text-secondary">to</span>
            <DateInput
              value={dateRange.end}
              onChange={(value) => handleDateChange('end', value)}
              placeholder="End date"
            />
          </div>
        </div>

        {/* Summary stats */}
        <SquadSummaryStats summary={data.summary} />

        {/* Performance Table */}
        <div className="bg-background-elevated border border-border rounded-lg overflow-hidden shadow-md">
          <div className="p-6 border-b border-border">
            <h3 className="text-xl font-semibold text-text-primary">Swimmer Performance Breakdown</h3>
            <p className="text-sm text-text-secondary mt-1">Click on a swimmer to view event details</p>
          </div>

          {data.swimmers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-secondary">
                No performance data available for the selected date range.
              </p>
              <p className="text-text-muted text-sm mt-2">
                Try adjusting the date range or ensure swimmers have logged workouts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background">
                  <tr className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    <th className="px-6 py-3">Swimmer</th>
                    <th className="px-6 py-3 text-center">Events</th>
                    <th className="px-6 py-3 text-center">PRs</th>
                    <th className="px-6 py-3 text-center">Avg Improvement</th>
                    <th className="px-6 py-3 text-center">Best Improvement</th>
                    <th className="px-6 py-3 text-center">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.swimmers.map((swimmer) => {
                    const isExpanded = expandedSwimmer === swimmer.swimmer_id;
                    const isImproving = swimmer.avg_improvement_pct < 0;
                    
                    return (
                      <React.Fragment key={swimmer.swimmer_id}>
                        {/* Main row */}
                        <tr 
                          className="hover:bg-background cursor-pointer transition-colors"
                          onClick={() => toggleSwimmerExpanded(swimmer.swimmer_id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center">
                                <span className="text-primary font-semibold text-sm">
                                  {swimmer.swimmer_name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-text-primary">{swimmer.swimmer_name}</div>
                                <div className="text-xs text-text-secondary">
                                  {isExpanded ? 'Hide' : 'View'} event breakdown
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-text-primary">
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
                            <span className={`font-semibold ${
                              swimmer.best_improvement_pct < 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {swimmer.best_improvement_pct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isImproving ? (
                              <TrendingDown className="w-5 h-5 text-green-400 mx-auto" />
                            ) : (
                              <TrendingUp className="w-5 h-5 text-red-400 mx-auto" />
                            )}
                          </td>
                        </tr>

                        {/* Expanded event details */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-background">
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                                  Event Performance Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {swimmer.events.map((event, idx) => {
                                    const eventImprovement = event.improvement_pct;
                                    const eventImproving = eventImprovement < 0;
                                    
                                    return (
                                      <div 
                                        key={idx}
                                        className="bg-background-elevated border border-border rounded-lg p-4"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h5 className="font-medium text-text-primary text-sm">
                                                {formatEventName(event.event)}
                                              </h5>
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getActivityBadgeStyles(event.activity)}`}>
                                                {formatActivity(event.activity)}
                                              </span>
                                            </div>
                                            <div className="text-xs text-text-secondary">
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
                                            <span className="text-text-secondary">First:</span>
                                            <span className="text-text-primary font-mono">
                                              {formatTimeFromSeconds(event.first_time)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-text-secondary">Best:</span>
                                            <span className="text-primary font-mono font-semibold">
                                              {formatTimeFromSeconds(event.best_time)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-text-secondary">Latest:</span>
                                            <span className="text-text-primary font-mono">
                                              {formatTimeFromSeconds(event.latest_time)}
                                            </span>
                                          </div>
                                          <div className="pt-2 border-t border-border">
                                            <div className="flex items-center justify-between">
                                              <span className="text-text-secondary">Change:</span>
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
    </div>
  );
};

export default SquadPerformanceTab;
