import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getEventAttempts,
  getBestSplits,
  type EventQuery,
  formatTime,
  intervalToSeconds,
  type RaceSplit,
  type BestSplitsResponse,
} from "../../../services/workoutResultService";
import AttemptsStats from "./AttemptsStats";
import AttemptsChart from "./AttemptsChart";
import RaceComparisonModal from "./RaceComparisonModal";
import { X, AlertCircle, Activity, Edit2, Trash2, Calendar, Clock, ChevronDown, TrendingUp, TrendingDown, GitCompare } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAnalytics } from "../../../hooks/useAnalytics";

export default function AttemptsModal({
  open,
  onClose,
  query,
  canManageResults,
  onEditAttempt,
  onDeleteAttempt,
}: {
  open: boolean;
  onClose: () => void;
  query: EventQuery;
  canManageResults?: boolean;
  onEditAttempt?: (attemptId: string) => void;
  onDeleteAttempt?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<
    Array<{
      id: string;
      performedOn: string | null;
      timeSeconds: number;
      timeResult: string;
      reactionTime: number | null;
      splits: RaceSplit[];
    }>
  >([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [bestSplits, setBestSplits] = useState<BestSplitsResponse | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedRaces, setSelectedRaces] = useState<Set<string>>(new Set());
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  
  const { track } = useAnalytics();

  const handleDeleteAttempt = async (attemptId: string) => {
    if (!confirm('Are you sure you want to delete this attempt? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('workout_result')
        .delete()
        .eq('id', attemptId);

      if (error) throw error;

      // Remove from local state
      setRows(prev => prev.filter(r => r.id !== attemptId));
      
      // Notify parent to refresh data
      if (onDeleteAttempt) {
        onDeleteAttempt();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete attempt');
    }
  };


  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const [attemptsData, splitsData] = await Promise.all([
          getEventAttempts(query),
          getBestSplits(query)
        ]);
        if (!mounted) return;
        setRows(attemptsData);
        setBestSplits(splitsData);
        setErr("");
      } catch (e: any) {
        if (!mounted) return;
        setErr(e.message ?? "Failed to load attempts");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, query]);

  // Get unique years from attempts
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rows.forEach(row => {
      if (row.performedOn) {
        const year = new Date(row.performedOn).getFullYear().toString();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)); // Newest first
  }, [rows]);

  // Filter rows by selected year
  const filteredRows = useMemo(() => {
    if (selectedYear === "all") return rows;
    return rows.filter(row => {
      if (!row.performedOn) return false;
      const year = new Date(row.performedOn).getFullYear().toString();
      return year === selectedYear;
    });
  }, [rows, selectedYear]);

  // Chart data - temporal order (as received)
  const data = useMemo(
    () =>
      filteredRows.map((r, i) => ({
        i: i + 1,
        date: r.performedOn
          ? new Date(r.performedOn).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : `#${i + 1}`,
        seconds: r.timeSeconds,
      })),
    [filteredRows]
  );

  // Table data - sorted by performance (fastest first)
  const sortedRows = useMemo(
    () => [...filteredRows].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [filteredRows]
  );

  const first = filteredRows[0]?.timeSeconds;
  const last = filteredRows[filteredRows.length - 1]?.timeSeconds;
  const best = filteredRows.reduce(
    (m, r) => (r.timeSeconds < m ? r.timeSeconds : m),
    Number.POSITIVE_INFINITY
  );
  const improvedPct =
    first && last ? Math.round(((first - last) / first) * 100) : 0;

  // Calculate recent trend (last 3-5 attempts)
  const recentTrend = useMemo(() => {
    if (filteredRows.length < 2) return null;
    
    const recentCount = Math.min(5, filteredRows.length);
    const recentResults = filteredRows.slice(-recentCount); // Get last 3-5 results
    
    if (recentResults.length < 2) return null;
    
    const oldestRecent = recentResults[0].timeSeconds;
    const newestRecent = recentResults[recentResults.length - 1].timeSeconds;
    const trendDelta = newestRecent - oldestRecent;
    const percentage = oldestRecent > 0 ? Math.round((trendDelta / oldestRecent) * 100) : 0;
    
    // Calculate average improvement per attempt
    const avgChangePerAttempt = trendDelta / (recentResults.length - 1);
    
    return {
      improving: trendDelta < -0.5, // Improved by more than 0.5s
      declining: trendDelta > 0.5, // Got slower by more than 0.5s
      stable: Math.abs(trendDelta) <= 0.5,
      delta: trendDelta,
      count: recentResults.length,
      times: recentResults.map(r => r.timeSeconds),
      avgChangePerAttempt,
      percentage
    };
  }, [filteredRows]);

  const captialize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Helper to get delta from best split
  const getSplitDelta = (split: RaceSplit): { delta: number; isBest: boolean } | null => {
    if (!bestSplits) return null;
    
    const bestSplit = bestSplits.best_splits.find(
      bs => bs.split_distance === split.split_distance
    );
    
    if (!bestSplit) return null;
    
    const currentSeconds = intervalToSeconds(split.cumulative_time);
    const delta = currentSeconds - bestSplit.best_seconds;
    const isBest = Math.abs(delta) < 0.01; // Within 0.01s = best
    
    return { delta, isBest };
  };

  // Memoized toggle function to avoid recreating on each render
  const toggleRowExpansion = useMemo(() => (rowId: string, numSplits: number) => {
    setExpandedRows(prev => {
      const newExpanded = new Set(prev);
      const isCurrentlyExpanded = prev.has(rowId);
      
      if (isCurrentlyExpanded) {
        newExpanded.delete(rowId);
      } else {
        newExpanded.add(rowId);
        // Track when user views split analysis (async, non-blocking)
        if (bestSplits && bestSplits.best_splits.length > 0) {
          setTimeout(() => {
            track('Best Splits Analyzed', {
              event_type: `${query.distance}m ${query.stroke}`,
              swimmer_id: query.swimmerId,
              num_splits: numSplits,
              result_units: query.resultUnits
            });
          }, 0);
        }
      }
      
      return newExpanded;
    });
  }, [bestSplits, query, track]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-background-secondary border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="relative flex items-center justify-between p-6 sm:p-8 border-b border-border bg-background-elevated">
          {/* Gradient top bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-dark via-primary to-accent"></div>

          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
              {query.distance}
              {query.units === "yards" ? "Y" : "M"} {captialize(query.stroke)}{" "}
              {captialize(query.activity)}
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              {query.equipment !== "none" && (
                <p className="text-text-secondary text-sm">
                  Equipment:{" "}
                  <span className="font-semibold text-primary">
                    {query.equipment}
                  </span>
                </p>
              )}
              {availableYears.length > 0 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="year-filter" className="text-sm text-text-secondary">
                    Year:
                  </label>
                  <select
                    id="year-filter"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1 text-sm bg-background-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/50 transition-colors"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Compare Races Button */}
              {filteredRows.length >= 2 && (
                <div className="flex items-center gap-2">
                  {!comparisonMode ? (
                    <button
                      onClick={() => setComparisonMode(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 text-primary rounded-lg transition-all hover:scale-105"
                    >
                      <GitCompare size={16} />
                      Compare Races
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (selectedRaces.size >= 2 && selectedRaces.size <= 4) {
                            // Track race comparison event
                            track('Race Comparison Viewed', {
                              event_type: `${query.distance}m ${query.stroke}`,
                              num_races_compared: selectedRaces.size,
                              swimmer_id: query.swimmerId,
                              result_units: query.resultUnits
                            });
                            setShowComparisonModal(true);
                          }
                        }}
                        disabled={selectedRaces.size < 2}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-success/10 hover:bg-success/20 border border-success/30 hover:border-success/50 text-success rounded-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <GitCompare size={16} />
                        Compare ({selectedRaces.size})
                      </button>
                      <button
                        onClick={() => {
                          setComparisonMode(false);
                          setSelectedRaces(new Set());
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-danger transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-background-tertiary border border-border text-text-muted hover:bg-background-secondary hover:border-danger hover:text-danger hover:scale-105 transition-all flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {err && (
            <div className="bg-background-elevated border border-danger rounded-xl p-4 mb-6 flex items-center gap-3 animate-in slide-in-from-top duration-300">
              <AlertCircle size={20} className="text-danger shrink-0" />
              <p className="text-danger text-sm">{err}</p>
            </div>
          )}

          {loading && (
            <div className="space-y-6">
              {/* Loading stats */}
              <div className="flex flex-col sm:flex-row gap-6">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-32 bg-background-elevated rounded-2xl border border-border animate-pulse"
                  >
                    <div className="p-6">
                      <div className="h-4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded mb-3"></div>
                      <div className="h-6 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded mb-2"></div>
                      <div className="h-3 w-2/3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Loading chart */}
              <div className="h-96 bg-background-elevated rounded-2xl border border-border animate-pulse">
                <div className="p-6">
                  <div className="h-6 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded mb-6"></div>
                  <div className="h-64 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded"></div>
                </div>
              </div>
            </div>
          )}

          {!loading && filteredRows.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-background-elevated border-2 border-dashed border-border rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary mb-4">
                <Activity size={32} />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {selectedYear === "all" ? "No Attempts Yet" : `No Attempts in ${selectedYear}`}
              </h3>
              <p className="text-text-muted">
                {selectedYear === "all" 
                  ? "No attempts have been recorded for this event."
                  : "No attempts recorded for this year. Try selecting a different year."}
              </p>
            </div>
          )}

          {!loading && filteredRows.length > 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-500 delay-200">
              <AttemptsStats
                recentTrend={recentTrend}
                best={best}
                totalAttempts={filteredRows.length}
                improvedPct={improvedPct}
              />

              <AttemptsChart data={data} />

              {/* List of all attempts with edit buttons */}
              <div className="bg-background-elevated border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-background-secondary/50">
                  <h3 className="text-sm font-semibold text-text-primary">
                    All Attempts
                  </h3>
                  <p className="text-xs text-text-tertiary mt-1">
                    {filteredRows.length} {filteredRows.length === 1 ? "attempt" : "attempts"}{" "}
                    {selectedYear === "all" ? "recorded" : `in ${selectedYear}`}
                  </p>
                </div>
                
                {/* Table format for better readability with many attempts */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background-secondary/30 border-b border-border">
                      <tr>
                        {comparisonMode && (
                          <th className="w-12 px-4 py-2"></th>
                        )}
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Rank</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Time</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Splits</th>
                        {canManageResults && !comparisonMode && (
                          <th className="text-right px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedRows.map((row, index) => {
                        const isBest = row.timeSeconds === best;
                        const hasSplits = row.splits && row.splits.length > 0;
                        const isExpanded = expandedRows.has(row.id);
                        const isSelected = selectedRaces.has(row.id);
                        
                        return (
                          <>
                            <tr
                              key={row.id}
                              className={`hover:bg-background-secondary/50 transition-colors ${isBest ? 'bg-primary/5' : ''} ${isSelected ? 'bg-accent/10' : ''}`}
                            >
                              {/* Checkbox for comparison */}
                              {comparisonMode && (
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const newSelection = new Set(selectedRaces);
                                      if (e.target.checked) {
                                        if (newSelection.size < 4) {
                                          newSelection.add(row.id);
                                        }
                                      } else {
                                        newSelection.delete(row.id);
                                      }
                                      setSelectedRaces(newSelection);
                                    }}
                                    disabled={!isSelected && selectedRaces.size >= 4}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 disabled:opacity-50 cursor-pointer"
                                  />
                                </td>
                              )}

                              {/* Rank */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                                    index === 0 
                                      ? 'bg-gradient-to-br from-primary/30 to-accent/30 text-primary border-2 border-primary/40' 
                                      : 'bg-background-tertiary border border-border text-text-secondary'
                                  }`}>
                                    #{index + 1}
                                  </div>
                                  {index === 0 && (
                                    <span className="text-xs font-semibold text-primary">
                                      BEST
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Date */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Calendar size={14} className="text-text-muted" />
                                  <span className="text-sm text-text-secondary">
                                    {row.performedOn
                                      ? new Date(row.performedOn).toLocaleDateString(
                                          undefined,
                                          {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          }
                                        )
                                      : "Unknown"}
                                  </span>
                                </div>
                              </td>

                              {/* Time */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Clock
                                    size={14}
                                    className={
                                      isBest ? "text-primary" : "text-text-muted"
                                    }
                                  />
                                  <span
                                    className={`text-lg font-bold ${
                                      isBest ? "text-primary" : "text-text-primary"
                                    }`}
                                  >
                                    {formatTime(row.timeSeconds)}
                                  </span>
                                </div>
                              </td>

                              {/* Splits toggle */}
                              <td className="px-4 py-3">
                                {hasSplits ? (
                                  <button
                                    onClick={() => toggleRowExpansion(row.id, row.splits.length)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-medium transition-all hover:scale-105"
                                  >
                                    <span>{row.splits.length}</span>
                                    <ChevronDown 
                                      size={14} 
                                      className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                  </button>
                                ) : (
                                  <span className="text-xs text-text-tertiary">—</span>
                                )}
                              </td>

                              {/* Actions */}
                              {canManageResults && !comparisonMode && (
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    {onEditAttempt && (
                                      <button
                                        onClick={() => onEditAttempt(row.id)}
                                        className="p-2 rounded-lg bg-background-tertiary border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent transition-all duration-200 hover:scale-105"
                                        title="Edit attempt"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteAttempt(row.id)}
                                      className="p-2 rounded-lg bg-background-tertiary border border-border/50 hover:border-danger/50 hover:bg-danger/10 text-text-muted hover:text-danger transition-all duration-200 hover:scale-105"
                                      title="Delete attempt"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                            
                            {/* Expanded splits row */}
                            {isExpanded && hasSplits && (
                              <tr key={`${row.id}-splits`} className="bg-background-elevated/30">
                                <td colSpan={canManageResults ? 5 : 4} className="px-4 py-3">
                                  <div className="space-y-3 ml-4">
                                    {/* Split times */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {row.splits.map((split, idx) => {
                                        const deltaInfo = getSplitDelta(split);
                                        
                                        return (
                                          <div key={split.id} className="inline-flex items-center gap-2">
                                            <div className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border ${
                                              deltaInfo?.isBest 
                                                ? 'bg-primary/10 border-primary/40' 
                                                : 'bg-background-secondary/60 border-border/40'
                                            }`}>
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-semibold text-primary">
                                                  {split.split_distance}m
                                                </span>
                                                <span className="text-xs font-mono font-bold text-text-primary">
                                                  {formatTime(intervalToSeconds(split.split_time))}
                                                </span>
                                                <span className="text-[10px] text-text-tertiary font-mono">
                                                  ({formatTime(intervalToSeconds(split.cumulative_time))})
                                                </span>
                                              </div>
                                              {deltaInfo && !deltaInfo.isBest && (
                                                <div className={`flex items-center gap-1 text-[10px] font-mono ${
                                                  deltaInfo.delta < 0 ? 'text-success' : 'text-danger'
                                                }`}>
                                                  {deltaInfo.delta < 0 ? (
                                                    <TrendingDown size={10} />
                                                  ) : (
                                                    <TrendingUp size={10} />
                                                  )}
                                                  <span>
                                                    {deltaInfo.delta > 0 ? '+' : ''}{deltaInfo.delta.toFixed(2)}s
                                                  </span>
                                                </div>
                                              )}
                                              {deltaInfo?.isBest && (
                                                <div className="text-[10px] font-semibold text-primary">
                                                  BEST
                                                </div>
                                              )}
                                            </div>
                                            {idx < row.splits.length - 1 && (
                                              <div className="w-2 h-px bg-border"></div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!open) return null;

  return createPortal(
    <>
      {modalContent}
      {/* Race Comparison Modal */}
      {showComparisonModal && (
        <RaceComparisonModal
          open={showComparisonModal}
          onClose={() => {
            setShowComparisonModal(false);
            setComparisonMode(false);
            setSelectedRaces(new Set());
          }}
          races={rows.filter(r => selectedRaces.has(r.id))}
          eventName={`${query.distance}${query.units === "yards" ? "Y" : "M"} ${captialize(query.stroke)} ${captialize(query.activity)}`}
        />
      )}
    </>,
    document.body
  );
}
