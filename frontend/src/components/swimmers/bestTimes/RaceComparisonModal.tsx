import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, TrendingDown, TrendingUp, Minus, BarChart3, Clock, Timer } from "lucide-react";
import { formatTime, intervalToSeconds, type RaceSplit } from "../../../features/swimmers/bestTimesApi";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

type RaceAttempt = {
  id: string;
  performedOn: string | null;
  timeSeconds: number;
  timeResult: string;
  splits: RaceSplit[];
};

type RaceComparisonModalProps = {
  open: boolean;
  onClose: () => void;
  races: RaceAttempt[];
  eventName: string;
};

export default function RaceComparisonModal({ 
  open, 
  onClose, 
  races, 
  eventName 
}: RaceComparisonModalProps) {
  
  // Color palette for races
  const raceColors = ['#22D3EE', '#10B981', '#F59E0B', '#EF4444'];
  
  // Check if all races have splits to determine default view
  const allRacesHaveSplits = useMemo(() => {
    return races.every(race => race.splits && race.splits.length > 0);
  }, [races]);
  
  const anyRaceHasSplits = useMemo(() => {
    return races.some(race => race.splits && race.splits.length > 0);
  }, [races]);
  
  const [chartViewMode, setChartViewMode] = useState<'cumulative' | 'splits'>(
    allRacesHaveSplits ? 'splits' : 'cumulative'
  );
  
  // Extract distance from event name (e.g., "400m Freestyle" -> 400)
  const eventDistance = useMemo(() => {
    const match = eventName.match(/(\d+)m/);
    return match ? parseInt(match[1]) : null;
  }, [eventName]);
  
  // Get all unique split distances across all races
  const allSplitDistances = useMemo(() => {
    const distances = new Set<number>();
    races.forEach(race => {
      if (race.splits && race.splits.length > 0) {
        race.splits.forEach(split => distances.add(split.split_distance));
      } else if (eventDistance) {
        // If no splits, use the event distance as the only point
        distances.add(eventDistance);
      }
    });
    return Array.from(distances).sort((a, b) => a - b);
  }, [races, eventDistance]);

  // Build comparison table data
  const comparisonData = useMemo(() => {
    return allSplitDistances.map(distance => {
      const row: any = { distance };
      
      races.forEach((race, idx) => {
        const split = race.splits?.find(s => s.split_distance === distance);
        if (split) {
          row[`race${idx}_cumulative`] = intervalToSeconds(split.cumulative_time);
          row[`race${idx}_split`] = intervalToSeconds(split.split_time);
          row[`race${idx}_split_str`] = split.split_time;
          row[`race${idx}_cumulative_str`] = split.cumulative_time;
        }
      });
      
      return row;
    });
  }, [races, allSplitDistances]);

  // Chart data for cumulative time progression
  const chartData = useMemo(() => {
    // Get max distance from races with splits, or use 0
    const maxDistance = allSplitDistances.length > 0 
      ? allSplitDistances[allSplitDistances.length - 1]
      : 0;
    
    const data = allSplitDistances.map(distance => {
      const point: any = { distance: `${distance}m` };
      
      races.forEach((race, idx) => {
        if (race.splits && race.splits.length > 0) {
          const split = race.splits.find(s => s.split_distance === distance);
          if (split) {
            point[`Race ${idx + 1}`] = intervalToSeconds(split.cumulative_time);
          }
        }
      });
      
      return point;
    });
    
    // Add final time point for races without splits
    if (maxDistance > 0) {
      const finalPoint: any = { distance: `${maxDistance}m` };
      let hasRaceWithoutSplits = false;
      
      races.forEach((race, idx) => {
        if (!race.splits || race.splits.length === 0) {
          finalPoint[`Race ${idx + 1}`] = race.timeSeconds;
          hasRaceWithoutSplits = true;
        } else {
          // For races with splits, use the last split's cumulative time
          const lastSplit = race.splits[race.splits.length - 1];
          if (lastSplit) {
            finalPoint[`Race ${idx + 1}`] = intervalToSeconds(lastSplit.cumulative_time);
          }
        }
      });
      
      // Only add/update final point if there are races without splits
      if (hasRaceWithoutSplits) {
        const existingPointIndex = data.findIndex(p => p.distance === `${maxDistance}m`);
        if (existingPointIndex >= 0) {
          data[existingPointIndex] = finalPoint;
        } else {
          data.push(finalPoint);
        }
      }
    }
    
    return data;
  }, [races, allSplitDistances]);

  // Chart data for split time comparison (individual split times only)
  const splitChartData = useMemo(() => {
    return allSplitDistances.map(distance => {
      const point: any = { distance: `${distance}m` };
      
      races.forEach((race, idx) => {
        if (race.splits && race.splits.length > 0) {
          const split = race.splits.find(s => s.split_distance === distance);
          if (split) {
            point[`Race ${idx + 1}`] = intervalToSeconds(split.split_time);
          }
        }
      });
      
      return point;
    });
  }, [races, allSplitDistances]);

  // Use the appropriate chart data based on view mode
  const activeChartData = chartViewMode === 'splits' ? splitChartData : chartData;

  // Fallback chart data when no races have splits - show final times as simple comparison
  const finalTimesChartData = useMemo(() => {
    if (anyRaceHasSplits) return [];
    
    return races.map((race, idx) => ({
      name: race.performedOn 
        ? new Date(race.performedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : `Race ${idx + 1}`,
      time: race.timeSeconds,
      color: raceColors[idx % raceColors.length]
    }));
  }, [races, anyRaceHasSplits]);

  // Calculate dynamic Y-axis domain for better visualization of close races
  const yAxisDomain = useMemo((): [number, number] => {
    // For races without splits, use final times
    if (!anyRaceHasSplits) {
      const times = races.map(r => r.timeSeconds);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const timeRange = maxTime - minTime;
      const padding = Math.max(timeRange * 0.1, 1);
      
      return [
        Math.max(0, minTime - padding),
        maxTime + padding
      ];
    }
    
    // For races with splits, use chart data
    const allTimes = activeChartData.flatMap(point => 
      races.map((_, idx) => point[`Race ${idx + 1}`]).filter((val): val is number => val != null)
    );
    
    if (allTimes.length === 0) return [0, 100];
    
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const timeRange = maxTime - minTime;
    
    // Add 10% padding above and below, with minimum 2-second visible range
    const padding = Math.max(timeRange * 0.1, 1);
    
    return [
      Math.max(0, minTime - padding),
      maxTime + padding
    ];
  }, [activeChartData, races, anyRaceHasSplits]);

  // Calculate race statistics
  const raceStats = useMemo(() => {
    return races.map(race => {
      // Handle races without splits
      if (!race.splits || race.splits.length === 0) {
        return {
          avgSplit: race.timeSeconds,
          fastestSplit: race.timeSeconds,
          slowestSplit: race.timeSeconds,
          consistency: 0,
          splitType: 'N/A' as const,
          splitDiff: 0
        };
      }
      
      const splitTimes = race.splits.map(s => intervalToSeconds(s.split_time));
      const avgSplit = splitTimes.reduce((a, b) => a + b, 0) / splitTimes.length;
      const fastestSplit = Math.min(...splitTimes);
      const slowestSplit = Math.max(...splitTimes);
      
      // Calculate standard deviation for consistency
      const variance = splitTimes.reduce((sum, time) => sum + Math.pow(time - avgSplit, 2), 0) / splitTimes.length;
      const stdDev = Math.sqrt(variance);
      
      // Negative/positive split analysis (first half vs second half)
      const midPoint = Math.floor(splitTimes.length / 2);
      const firstHalf = splitTimes.slice(0, midPoint);
      const secondHalf = splitTimes.slice(midPoint);
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const splitType = secondHalfAvg < firstHalfAvg ? 'Negative' : secondHalfAvg > firstHalfAvg ? 'Positive' : 'Even';
      
      return {
        avgSplit,
        fastestSplit,
        slowestSplit,
        consistency: stdDev,
        splitType,
        splitDiff: secondHalfAvg - firstHalfAvg
      };
    });
  }, [races]);

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-background-secondary border border-border rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="relative flex items-center justify-between p-6 border-b border-border bg-background-elevated">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-dark via-primary to-accent"></div>
          
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-1">
              Race Comparison
            </h2>
            <p className="text-sm text-text-secondary">
              {eventName} • {races.length} races selected
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-background-tertiary border border-border text-text-muted hover:bg-background-secondary hover:border-danger hover:text-danger hover:scale-105 transition-all flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Cumulative Time Chart */}
          <div className="bg-background-elevated border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center text-accent">
                  <BarChart3 size={20} />
                </div>
                <h3 className="text-lg font-bold text-text-primary">
                  {!anyRaceHasSplits ? 'Final Time Comparison' : chartViewMode === 'cumulative' ? 'Cumulative Time Progression' : 'Split Time Comparison'}
                </h3>
              </div>
              
              {/* View Mode Toggle - only show if at least one race has splits */}
              {anyRaceHasSplits && (
                <div className="flex gap-2 bg-background-card border border-border rounded-lg p-1">
                <button
                  onClick={() => setChartViewMode('splits')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    chartViewMode === 'splits'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Timer size={16} />
                  Split Times
                </button>
                <button
                  onClick={() => setChartViewMode('cumulative')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    chartViewMode === 'cumulative'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Clock size={16} />
                  Cumulative
                </button>
              </div>
              )}
            </div>
            
            <ResponsiveContainer width="100%" height={300}>
              {!anyRaceHasSplits ? (
                // Bar chart for final times when no splits exist
                <BarChart data={finalTimesChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    stroke="#475569"
                  />
                  <YAxis 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                    stroke="#475569"
                    tickFormatter={(value) => formatTime(value)}
                  />
                  <Tooltip
                    contentStyle={{ 
                      background: 'rgba(30, 41, 59, 0.95)', 
                      border: '1px solid #475569', 
                      borderRadius: '12px',
                      color: '#F8FAFC'
                    }}
                    formatter={(value: any) => formatTime(value as number)}
                    labelFormatter={(label) => `Race: ${label}`}
                  />
                  <Bar dataKey="time" radius={[8, 8, 0, 0]}>
                    {finalTimesChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                // Line chart for races with splits
                <LineChart data={activeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
                <XAxis 
                  dataKey="distance" 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  stroke="#475569"
                />
                <YAxis 
                  domain={yAxisDomain}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  stroke="#475569"
                  tickFormatter={(value) => formatTime(value)}
                  tickCount={8}
                />
                <Tooltip
                  contentStyle={{ 
                    background: 'rgba(30, 41, 59, 0.95)', 
                    border: '1px solid #475569', 
                    borderRadius: '12px',
                    color: '#F8FAFC'
                  }}
                  formatter={(value: any) => formatTime(value as number)}
                />
                <Legend />
                {races.map((_, idx) => (
                  <Line 
                    key={idx}
                    type="monotone" 
                    dataKey={`Race ${idx + 1}`}
                    stroke={raceColors[idx % raceColors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Race Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {races.map((race, idx) => {
              const stats = raceStats[idx];
              const raceDate = race.performedOn 
                ? new Date(race.performedOn).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
                : `Race ${idx + 1}`;
              
              return (
                <div key={race.id} className="bg-background-elevated border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: raceColors[idx % raceColors.length] }}
                    ></div>
                    <h4 className="font-semibold text-text-primary text-sm">
                      {raceDate}
                    </h4>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Final Time:</span>
                      <span className="font-mono font-bold text-text-primary">
                        {formatTime(race.timeSeconds)}
                      </span>
                    </div>
                    {race.splits && race.splits.length > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Avg Split:</span>
                          <span className="font-mono text-text-secondary">
                            {formatTime(stats.avgSplit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Fastest Split:</span>
                          <span className="font-mono text-success">
                            {formatTime(stats.fastestSplit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Slowest Split:</span>
                          <span className="font-mono text-danger">
                            {formatTime(stats.slowestSplit)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border/50">
                          <span className="text-text-tertiary">Pacing:</span>
                          <span className={`font-semibold ${
                            stats.splitType === 'Negative' ? 'text-success' : 
                            stats.splitType === 'Positive' ? 'text-warning' : 
                            'text-text-secondary'
                          }`}>
                            {stats.splitType}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Split-by-Split Comparison Table */}
          <div className="bg-background-elevated border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-text-primary">Split-by-Split Comparison</h3>
              <p className="text-xs text-text-tertiary mt-1">
                Cumulative times at each split with deltas between races
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background-secondary/30 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase">
                      Distance
                    </th>
                    {races.map((race, idx) => {
                      const raceDate = race.performedOn 
                        ? new Date(race.performedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : `Race ${idx + 1}`;
                      
                      return (
                        <th key={idx} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: raceColors[idx % raceColors.length] }}
                            ></div>
                            <span className="text-xs font-semibold text-text-primary">
                              {raceDate}
                            </span>
                          </div>
                          <div className="text-[10px] text-text-tertiary font-normal mt-0.5">
                            {formatTime(race.timeSeconds)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonData.map((row, rowIdx) => {
                    // Find fastest cumulative time at this split
                    const cumulativeTimes = races.map((_, idx) => row[`race${idx}_cumulative`]).filter(Boolean);
                    const fastestTime = Math.min(...cumulativeTimes);
                    
                    return (
                      <tr key={rowIdx} className="hover:bg-background-secondary/30">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-primary">
                            {row.distance}m
                          </span>
                        </td>
                        {races.map((_, idx) => {
                          const cumulative = row[`race${idx}_cumulative`];
                          const split = row[`race${idx}_split`];
                          const isFastest = cumulative && Math.abs(cumulative - fastestTime) < 0.01;
                          
                          if (!cumulative) {
                            return (
                              <td key={idx} className="px-4 py-3">
                                <span className="text-text-tertiary">—</span>
                              </td>
                            );
                          }
                          
                          const delta = cumulative - fastestTime;
                          
                          return (
                            <td key={idx} className="px-4 py-3">
                              <div className="space-y-1">
                                <div className={`font-mono text-sm font-bold ${
                                  isFastest ? 'text-success' : 'text-text-primary'
                                }`}>
                                  {formatTime(cumulative)}
                                  {isFastest && <span className="ml-1 text-[10px]">★</span>}
                                </div>
                                <div className="text-[10px] text-text-tertiary font-mono">
                                  Split: {formatTime(split)}
                                </div>
                                {!isFastest && delta > 0 && (
                                  <div className="flex items-center gap-1 text-[10px] text-danger font-mono">
                                    <TrendingUp size={10} />
                                    +{delta.toFixed(2)}s
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
