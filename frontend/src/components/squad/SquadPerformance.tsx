import React, { useState, useEffect } from 'react';
import { 
  getSquadPerformance, 
  SquadPerformanceData,
  formatTimeFromSeconds 
} from '@/services/metricsService';
import { SquadSummaryStats } from '@/components/squad-analytics/SquadSummaryStats';
import DateInput from '@/components/ui/DateInput';
import AttemptsModal from '@/components/swimmers/bestTimes/AttemptsModal';
import type { EventQuery } from '@/services/workoutResultService';
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
  const [selectedEventQuery, setSelectedEventQuery] = useState<EventQuery | null>(null);

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

  const handleEventClick = (event: any, swimmerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      
      // Parse event key to build EventQuery
      // Event key format: "{distance}M_{stroke}_{activity}_{result_units}_{equipment?}"
      if (!event?.event) {
        console.error('[ERROR] Event object missing .event property');
        return;
      }
      
      const parts = event.event.split('_');
      
      const distanceStr = parts[0]; // e.g., "100M"
      const distance = parseInt(distanceStr.replace('M', ''));
      const stroke = parts[1] || 'freestyle'; // e.g., "freestyle"
      const activity = parts[2] || 'swim'; // e.g., "swim"
      const resultUnits = (parts[3] || 'SCM') as 'SCM' | 'LCM'; // e.g., "SCM" or "LCM"
      const equipment = parts[4] || 'none'; // e.g., "fins" or undefined
      
      if (isNaN(distance)) {
        console.error('[ERROR] Invalid distance parsed:', distanceStr);
        return;
      }
      
      const eventQuery: EventQuery = {
        swimmerId,
        distance,
        stroke,
        activity,
        equipment,
        units: 'meters',
        resultUnits
      };
      
      setSelectedEventQuery(eventQuery);
    } catch (error) {
      console.error('[ERROR] Exception in handleEventClick:', error);
    }
  };

  const handleCloseEventModal = () => {
    setSelectedEventQuery(null);
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
    if (act === 'kick') return 'bg-linear-to-br from-orange-500/20 to-orange-500/10 border border-orange-500/40 text-orange-400';
    if (act === 'pull') return 'bg-linear-to-br from-green-500/20 to-green-500/10 border border-green-500/40 text-green-400';
    return 'bg-linear-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/40 text-cyan-400';
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
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
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
        {/* Header with date range picker */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Performance Analytics</h2>
            <p className="text-sm text-slate-400 mt-1">Track improvement trends across your squad</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm rounded-xl px-3 py-2 border border-slate-800/40">
            <DateInput
              label=""
              value={dateRange.start}
              onChange={(value) => handleDateChange('start', value)}
              placeholder="Start"
            />
            <span className="text-slate-500 font-medium text-sm">→</span>
            <DateInput
              label=""
              value={dateRange.end}
              onChange={(value) => handleDateChange('end', value)}
              placeholder="End"
            />
          </div>
        </div>

        {/* Summary stats */}
        <SquadSummaryStats summary={data.summary} />

        {/* Performance Table */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-lg overflow-hidden shadow-md">
          <div className="p-6 border-b border-slate-800/60">
            <h3 className="text-xl font-semibold text-slate-100">Swimmer Performance Breakdown</h3>
            <p className="text-sm text-slate-400 mt-1">Click on a swimmer to view event details</p>
          </div>

          {data.swimmers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400">
                No performance data available for the selected date range.
              </p>
              <p className="text-slate-500 text-sm mt-2">
                Try adjusting the date range or ensure swimmers have logged workouts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/30">
                  <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Swimmer</th>
                    <th className="px-6 py-3 text-center">Events</th>
                    <th className="px-6 py-3 text-center">PRs</th>
                    <th className="px-6 py-3 text-center">Avg Improvement</th>
                    <th className="px-6 py-3 text-center">Best Improvement</th>
                    <th className="px-6 py-3 text-center">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {data.swimmers.map((swimmer) => {
                    const isExpanded = expandedSwimmer === swimmer.swimmer_id;
                    const isImproving = swimmer.avg_improvement_pct < 0;
                    
                    return (
                      <React.Fragment key={swimmer.swimmer_id}>
                        {/* Main row */}
                        <tr 
                          className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                          onClick={() => toggleSwimmerExpanded(swimmer.swimmer_id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                                <span className="text-cyan-400 font-semibold text-sm">
                                  {swimmer.swimmer_name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-slate-100">{swimmer.swimmer_name}</div>
                                <div className="text-xs text-slate-400">
                                  {isExpanded ? 'Hide' : 'View'} event breakdown
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-slate-100">
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
                              swimmer.avg_improvement_pct < -0.1 ? 'text-green-400' : 
                              swimmer.avg_improvement_pct > 0.1 ? 'text-red-400' : 
                              'text-slate-400'
                            }`}>
                              {swimmer.avg_improvement_pct < -0.1 ? '' : swimmer.avg_improvement_pct > 0.1 ? '+' : ''}
                              {swimmer.avg_improvement_pct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`font-semibold ${
                              swimmer.best_improvement_pct < -0.1 ? 'text-green-400' : 
                              swimmer.best_improvement_pct > 0.1 ? 'text-red-400' : 
                              'text-slate-400'
                            }`}>
                              {swimmer.best_improvement_pct < -0.1 ? '' : swimmer.best_improvement_pct > 0.1 ? '+' : ''}
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
                            <td colSpan={6} className="px-6 py-4 bg-slate-800/30">
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                  Event Performance Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {swimmer.events.map((event, idx) => {
                                    const eventImprovement = event.improvement_pct;
                                    const eventImproving = eventImprovement < 0;
                                    const eventName = formatEventName(event.event);
                                    
                                    return (
                                      <div 
                                        key={idx}
                                        onClick={(e) => handleEventClick(event, swimmer.swimmer_id, e)}
                                        className="relative group bg-linear-to-br from-slate-900 to-slate-800 backdrop-blur-xl border-2 border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] overflow-hidden"
                                      >
                                        {/* Accent bars */}
                                        <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-cyan-500/50 via-blue-500/50 to-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-purple-500/50 via-blue-500/50 to-cyan-500/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="flex items-start justify-between mb-3">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1.5">
                                              <h5 className="font-semibold text-slate-100 text-sm bg-linear-to-r from-slate-100 to-slate-300 bg-clip-text group-hover:from-cyan-400 group-hover:to-blue-400 transition-all">
                                                {eventName}
                                              </h5>
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${getActivityBadgeStyles(event.activity)}`}>
                                                {formatActivity(event.activity)}
                                              </span>
                                            </div>
                                            <div className="text-xs text-slate-400 font-medium">
                                              {event.attempts} {event.attempts === 1 ? 'attempt' : 'attempts'}
                                            </div>
                                          </div>
                                          {event.personal_records > 0 && (
                                            <div className="flex items-center gap-1 px-2.5 py-1 bg-linear-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-xs font-semibold shadow-sm">
                                              <Trophy className="w-3.5 h-3.5" />
                                              {event.personal_records}
                                            </div>
                                          )}
                                        </div>
                                        
                                        <div className="space-y-2.5 text-xs">
                                          <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                                            <span className="text-slate-400 font-medium">First:</span>
                                            <span className="text-slate-200 font-mono font-semibold">
                                              {formatTimeFromSeconds(event.first_time)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center py-1.5 px-2 bg-linear-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg">
                                            <span className="text-cyan-400 font-medium">Best:</span>
                                            <span className="text-cyan-400 font-mono font-bold">
                                              {formatTimeFromSeconds(event.best_time)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
                                            <span className="text-slate-400 font-medium">Latest:</span>
                                            <span className="text-slate-200 font-mono font-semibold">
                                              {formatTimeFromSeconds(event.latest_time)}
                                            </span>
                                          </div>
                                          <div className="pt-2 mt-2 border-t-2 border-cyan-500/10">
                                            <div className="flex items-center justify-between py-1.5 px-2 bg-slate-800/40 rounded-lg">
                                              <span className="text-slate-400 font-medium">Change:</span>
                                              <div className="flex items-center gap-1.5">
                                                {eventImproving ? (
                                                  <TrendingDown className="w-3.5 h-3.5 text-green-400" />
                                                ) : (
                                                  <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                                                )}
                                                <span className={`font-bold ${
                                                  eventImproving ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                  {eventImproving ? '' : '+'}{eventImprovement.toFixed(1)}%
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>f
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

      {/* Event Attempts Modal */}
      {selectedEventQuery && (
        <AttemptsModal
          open={!!selectedEventQuery}
          onClose={handleCloseEventModal}
          query={selectedEventQuery}
          canManageResults={false}
        />
      )}
    </div>
  );
};

export default SquadPerformanceTab;

