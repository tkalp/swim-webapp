import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  getEventAttempts,
  getBestSplits,
  type EventQuery,
  formatTime,
  intervalToSeconds,
  type RaceSplit,
  type BestSplitsResponse,
} from "@/services/workoutResultService";
import AttemptsStats from "@/components/swimmers/bestTimes/AttemptsStats";
import AttemptsChart from "@/components/swimmers/bestTimes/AttemptsChart";
import RaceComparisonModal from "@/components/swimmers/bestTimes/RaceComparisonModal";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  X,
  AlertCircle,
  Activity,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  GitCompare,
  Award,
  Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
  const tableParentRef = useRef<HTMLDivElement>(null);

  const { track } = useAnalytics();
  const confirmDialog = useConfirmDialog();
  const { showToast } = useToast();

  const handleDeleteAttempt = async (attemptId: string) => {
    const confirmed = await confirmDialog.confirm({
      title: "Delete Attempt",
      message:
        "Are you sure you want to delete this attempt? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("workout_result")
        .delete()
        .eq("id", attemptId);

      if (error) throw error;

      // Remove from local state
      setRows((prev) => prev.filter((r) => r.id !== attemptId));

      // Notify parent to refresh data
      if (onDeleteAttempt) {
        onDeleteAttempt();
      }

      showToast("Attempt deleted successfully", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to delete attempt", "error");
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
          getBestSplits(query),
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
    rows.forEach((row) => {
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
    return rows.filter((row) => {
      if (!row.performedOn) return false;
      const year = new Date(row.performedOn).getFullYear().toString();
      return year === selectedYear;
    });
  }, [rows, selectedYear]);

  // Chart data - temporal order (as received) - memoized with key to prevent lag
  // Group by date and take the fastest time for each day, track slower attempts
  const data = useMemo(() => {
    const grouped = new Map<
      string,
      { i: number; date: string; seconds: number; otherTimes?: number[] }
    >();

    filteredRows.forEach((r, i) => {
      const dateStr = r.performedOn
        ? new Date(r.performedOn).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : `#${i + 1}`;

      const existing = grouped.get(dateStr);
      if (!existing) {
        grouped.set(dateStr, {
          i: i + 1,
          date: dateStr,
          seconds: r.timeSeconds,
          otherTimes: [],
        });
      } else if (r.timeSeconds < existing.seconds) {
        // New faster time, move old time to otherTimes
        existing.otherTimes = existing.otherTimes || [];
        existing.otherTimes.push(existing.seconds);
        existing.seconds = r.timeSeconds;
        existing.i = i + 1;
      } else {
        // Slower time, add to otherTimes
        existing.otherTimes = existing.otherTimes || [];
        existing.otherTimes.push(r.timeSeconds);
      }
    });

    return Array.from(grouped.values());
  }, [filteredRows, selectedYear]);

  // Table data - sorted by performance (fastest first)
  const sortedRows = useMemo(
    () => [...filteredRows].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [filteredRows]
  );

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: (index) => {
      // Base row height + expanded splits height if applicable
      const row = sortedRows[index];
      const isExpanded = expandedRows.has(row.id);
      const baseHeight = 70;
      const splitsHeight = isExpanded && row.splits?.length ? 80 : 0;
      return baseHeight + splitsHeight;
    },
    overscan: 3,
  });

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
    const percentage =
      oldestRecent > 0 ? Math.round((trendDelta / oldestRecent) * 100) : 0;

    // Calculate average improvement per attempt
    const avgChangePerAttempt = trendDelta / (recentResults.length - 1);

    return {
      improving: trendDelta < -0.5, // Improved by more than 0.5s
      declining: trendDelta > 0.5, // Got slower by more than 0.5s
      stable: Math.abs(trendDelta) <= 0.5,
      delta: trendDelta,
      count: recentResults.length,
      times: recentResults.map((r) => r.timeSeconds),
      avgChangePerAttempt,
      percentage,
    };
  }, [filteredRows]);

  const captialize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Helper to get delta from best split
  const getSplitDelta = (
    split: RaceSplit
  ): { delta: number; isBest: boolean } | null => {
    if (!bestSplits) return null;

    const bestSplit = bestSplits.best_splits.find(
      (bs) => bs.split_distance === split.split_distance
    );

    if (!bestSplit) return null;

    const currentSeconds = intervalToSeconds(split.cumulative_time);
    const delta = currentSeconds - bestSplit.best_seconds;
    const isBest = Math.abs(delta) < 0.01; // Within 0.01s = best

    return { delta, isBest };
  };

  // Memoized toggle function to avoid recreating on each render
  const toggleRowExpansion = useMemo(
    () => (rowId: string, numSplits: number) => {
      setExpandedRows((prev) => {
        const newExpanded = new Set(prev);
        const isCurrentlyExpanded = prev.has(rowId);

        if (isCurrentlyExpanded) {
          newExpanded.delete(rowId);
        } else {
          newExpanded.add(rowId);
          // Track when user views split analysis (async, non-blocking)
          if (bestSplits && bestSplits.best_splits.length > 0) {
            setTimeout(() => {
              track("Best Splits Analyzed", {
                event_type: `${query.distance}m ${query.stroke}`,
                swimmer_id: query.swimmerId,
                num_splits: numSplits,
                result_units: query.resultUnits,
              });
            }, 0);
          }
        }

        return newExpanded;
      });

      // Force virtualizer to recalculate sizes after state update
      setTimeout(() => {
        rowVirtualizer.measure();
      }, 0);
    },
    [bestSplits, query, track, rowVirtualizer]
  );

  const modalContent = (
    <div
      className="fixed inset-0 z-9998 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-linear-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/20 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom duration-300 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent bars */}
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 z-30"></div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-purple-500 via-blue-500 to-cyan-500 z-30"></div>

        {/* Header */}
        <header className="relative flex items-center justify-between p-6 sm:p-8 border-b-2 border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              {query.distance}
              {query.units === "yards" ? "Y" : "M"} {captialize(query.stroke)}{" "}
              {captialize(query.activity)}
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              {query.equipment !== "none" && (
                <p className="text-slate-400 text-sm">
                  Equipment:{" "}
                  <span className="font-semibold text-cyan-400">
                    {query.equipment}
                  </span>
                </p>
              )}
              {availableYears.length > 0 && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="year-filter"
                    className="text-sm text-slate-400"
                  >
                    Year:
                  </label>
                  <select
                    id="year-filter"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-slate-800 border-2 border-cyan-500/30 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 hover:border-cyan-500/50 transition-all"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
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
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 border-2 border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 rounded-lg transition-all hover:scale-105 shadow-lg shadow-cyan-500/10"
                    >
                      <GitCompare size={16} />
                      Compare Races
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (
                            selectedRaces.size >= 2 &&
                            selectedRaces.size <= 4
                          ) {
                            // Track race comparison event
                            track("Race Comparison Viewed", {
                              event_type: `${query.distance}m ${query.stroke}`,
                              num_races_compared: selectedRaces.size,
                              swimmer_id: query.swimmerId,
                              result_units: query.resultUnits,
                            });
                            setShowComparisonModal(true);
                          }
                        }}
                        disabled={selectedRaces.size < 2}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-green-500/15 hover:bg-green-500/25 border-2 border-green-500/30 hover:border-green-500/50 text-green-400 rounded-lg transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-green-500/10"
                      >
                        <GitCompare size={16} />
                        Compare ({selectedRaces.size})
                      </button>
                      <button
                        onClick={() => {
                          setComparisonMode(false);
                          setSelectedRaces(new Set());
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors"
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
            className="w-10 h-10 rounded-xl bg-slate-800 border-2 border-slate-700/50 text-slate-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 hover:scale-110 transition-all flex items-center justify-center shadow-lg"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-900/30">
          {err && (
            <div className="bg-red-500/10 border-2 border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3 animate-in slide-in-from-top duration-300 backdrop-blur-sm">
              <AlertCircle size={20} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm font-medium">{err}</p>
            </div>
          )}

          {loading && (
            <div className="space-y-6">
              {/* Loading stats */}
              <div className="flex flex-col sm:flex-row gap-6">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-32 bg-slate-800/50 rounded-2xl border-2 border-cyan-500/20 animate-pulse backdrop-blur-sm"
                  >
                    <div className="p-6">
                      <div className="h-4 bg-linear-to-r from-cyan-500/10 via-cyan-500/20 to-cyan-500/10 rounded mb-3"></div>
                      <div className="h-6 bg-linear-to-r from-cyan-500/10 via-cyan-500/20 to-cyan-500/10 rounded mb-2"></div>
                      <div className="h-3 w-2/3 bg-linear-to-r from-cyan-500/10 via-cyan-500/20 to-cyan-500/10 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Loading chart */}
              <div className="h-96 bg-slate-800/50 rounded-2xl border-2 border-cyan-500/20 animate-pulse backdrop-blur-sm">
                <div className="p-6">
                  <div className="h-6 bg-linear-to-r from-cyan-500/10 via-cyan-500/20 to-cyan-500/10 rounded mb-6"></div>
                  <div className="h-64 bg-linear-to-r from-cyan-500/10 via-cyan-500/20 to-cyan-500/10 rounded"></div>
                </div>
              </div>
            </div>
          )}

          {!loading && filteredRows.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/30 border-2 border-dashed border-cyan-500/20 rounded-2xl p-8 text-center backdrop-blur-sm">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 mb-4 border border-cyan-500/30">
                <Activity size={32} />
              </div>
              <h3 className="text-lg font-semibold bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                {selectedYear === "all"
                  ? "No Attempts Yet"
                  : `No Attempts in ${selectedYear}`}
              </h3>
              <p className="text-slate-400">
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

              {/* Enhanced attempts table with virtual scrolling */}
              <div className="bg-linear-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl relative">
                {/* Accent bars */}
                <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500"></div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-purple-500 via-blue-500 to-cyan-500"></div>

                {/* Header */}
                <div className="p-5 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm relative z-20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                      <Trophy size={20} className="text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                        All Attempts
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {filteredRows.length}{" "}
                        {filteredRows.length === 1 ? "attempt" : "attempts"}{" "}
                        {selectedYear === "all"
                          ? "recorded"
                          : `in ${selectedYear}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sticky table header */}
                <div className="sticky top-0 z-10 bg-slate-800/98 backdrop-blur-md border-b-2 border-cyan-500/20 shadow-lg">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {comparisonMode && <div className="col-span-1"></div>}
                    <div
                      className={comparisonMode ? "col-span-2" : "col-span-2"}
                    >
                      Rank
                    </div>
                    <div
                      className={comparisonMode ? "col-span-3" : "col-span-3"}
                    >
                      Date
                    </div>
                    <div
                      className={comparisonMode ? "col-span-2" : "col-span-3"}
                    >
                      Time
                    </div>
                    {query.distance > 50 && (
                      <div
                        className={comparisonMode ? "col-span-2" : "col-span-2"}
                      >
                        Splits
                      </div>
                    )}
                    {canManageResults && !comparisonMode && (
                      <div className="col-span-2 text-right">Actions</div>
                    )}
                  </div>
                </div>

                {/* Table body with virtual scrolling */}
                <div
                  ref={tableParentRef}
                  className="overflow-auto"
                  style={{ maxHeight: "500px" }}
                >
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = sortedRows[virtualRow.index];
                      const index = virtualRow.index;
                      const isBest = row.timeSeconds === best;
                      const hasSplits = row.splits && row.splits.length > 0;
                      const isExpanded = expandedRows.has(row.id);
                      const isSelected = selectedRaces.has(row.id);

                      return (
                        <div
                          key={virtualRow.key}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {/* Main row */}
                          <div
                            className={`
                              grid grid-cols-12 gap-4 px-6 py-4 items-center
                              border-b border-slate-700/50
                              hover:bg-cyan-500/5 hover:border-cyan-500/30
                              transition-all duration-200
                              ${
                                isBest
                                  ? "bg-linear-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30"
                                  : ""
                              }
                              ${
                                isSelected
                                  ? "bg-purple-500/10 border-purple-500/30"
                                  : ""
                              }
                            `}
                          >
                            {/* Checkbox for comparison */}
                            {comparisonMode && (
                              <div className="col-span-1 flex items-center justify-center">
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
                                  disabled={
                                    !isSelected && selectedRaces.size >= 4
                                  }
                                  className="w-5 h-5 rounded border-2 border-cyan-500/30 bg-slate-800 checked:bg-cyan-500 checked:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-0 disabled:opacity-30 cursor-pointer transition-all"
                                />
                              </div>
                            )}

                            {/* Rank */}
                            <div
                              className={
                                comparisonMode ? "col-span-2" : "col-span-2"
                              }
                            >
                              <div className="flex items-center gap-2">
                                {index === 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-yellow-500/30 to-amber-500/30 border-2 border-yellow-500/50 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                                      <Award
                                        size={20}
                                        className="text-yellow-400"
                                      />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide">
                                        Best
                                      </span>
                                      <span className="text-xs text-yellow-400/70 font-semibold">
                                        #{index + 1}
                                      </span>
                                    </div>
                                  </div>
                                ) : index === 1 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-slate-400/20 to-slate-500/20 border-2 border-slate-400/40 flex items-center justify-center text-sm font-bold text-slate-300">
                                      #{index + 1}
                                    </div>
                                  </div>
                                ) : index === 2 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-700/20 to-orange-800/20 border-2 border-orange-700/40 flex items-center justify-center text-sm font-bold text-orange-400">
                                      #{index + 1}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-sm font-semibold text-slate-400">
                                    #{index + 1}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Date */}
                            <div
                              className={
                                comparisonMode ? "col-span-3" : "col-span-3"
                              }
                            >
                              <div className="flex items-center gap-2">
                                <Calendar
                                  size={16}
                                  className="text-cyan-500/60"
                                />
                                <span className="text-sm text-slate-300 font-medium">
                                  {row.performedOn
                                    ? new Date(
                                        row.performedOn
                                      ).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })
                                    : "Unknown"}
                                </span>
                              </div>
                            </div>

                            {/* Time */}
                            <div
                              className={
                                comparisonMode ? "col-span-2" : "col-span-3"
                              }
                            >
                              <div className="flex items-center gap-2">
                                <Clock
                                  size={16}
                                  className={
                                    isBest ? "text-cyan-400" : "text-slate-500"
                                  }
                                />
                                <span
                                  className={`text-xl font-bold font-mono ${
                                    isBest
                                      ? "bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"
                                      : "text-slate-200"
                                  }`}
                                >
                                  {formatTime(row.timeSeconds)}
                                </span>
                              </div>
                            </div>

                            {/* Splits toggle */}
                            <div
                              className={
                                comparisonMode ? "col-span-2" : "col-span-2"
                              }
                            >
                              {hasSplits && query.distance > 50 ? (
                                <button
                                  onClick={() =>
                                    toggleRowExpansion(
                                      row.id,
                                      row.splits.length
                                    )
                                  }
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 text-sm font-semibold transition-all hover:scale-105 shadow-lg shadow-cyan-500/10"
                                >
                                  <span>{row.splits.length}</span>
                                  <ChevronDown
                                    size={16}
                                    className={`transition-transform duration-300 ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="text-sm text-slate-600">
                                  —
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            {canManageResults && !comparisonMode && (
                              <div className="col-span-2 flex justify-end gap-2">
                                {onEditAttempt && (
                                  <button
                                    onClick={() => onEditAttempt(row.id)}
                                    className="p-2 rounded-lg bg-slate-800 border border-slate-700/50 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110 shadow-lg"
                                    title="Edit attempt"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteAttempt(row.id)}
                                  className="p-2 rounded-lg bg-slate-800 border border-slate-700/50 hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all duration-200 hover:scale-110 shadow-lg"
                                  title="Delete attempt"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Expanded splits section */}
                          {isExpanded && hasSplits && (
                            <div className="bg-slate-950/60 border-b border-slate-700/30 backdrop-blur-sm px-6 py-4">
                              <div className="flex items-center gap-2 flex-wrap ml-12">
                                {row.splits.map((split, idx) => {
                                  const deltaInfo = getSplitDelta(split);

                                  return (
                                    <div
                                      key={split.id}
                                      className="inline-flex items-center gap-2"
                                    >
                                      <div
                                        className={`
                                        inline-flex flex-col gap-1 px-3 py-2 rounded-xl border-2 transition-all hover:scale-105 shadow-lg
                                        ${
                                          deltaInfo?.isBest
                                            ? "bg-linear-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-cyan-500/20"
                                            : "bg-slate-800/80 border-slate-700/50 hover:border-slate-600"
                                        }
                                      `}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-cyan-400">
                                            {split.split_distance}m
                                          </span>
                                          <span className="text-sm font-mono font-bold text-slate-100">
                                            {formatTime(
                                              intervalToSeconds(
                                                split.split_time
                                              )
                                            )}
                                          </span>
                                          <span className="text-[10px] text-slate-500 font-mono">
                                            (
                                            {formatTime(
                                              intervalToSeconds(
                                                split.cumulative_time
                                              )
                                            )}
                                            )
                                          </span>
                                        </div>
                                        {deltaInfo && !deltaInfo.isBest && (
                                          <div
                                            className={`flex items-center gap-1 text-[10px] font-mono font-semibold ${
                                              deltaInfo.delta < 0
                                                ? "text-green-400"
                                                : "text-red-400"
                                            }`}
                                          >
                                            {deltaInfo.delta < 0 ? (
                                              <TrendingDown size={12} />
                                            ) : (
                                              <TrendingUp size={12} />
                                            )}
                                            <span>
                                              {deltaInfo.delta > 0 ? "+" : ""}
                                              {deltaInfo.delta.toFixed(2)}s
                                            </span>
                                          </div>
                                        )}
                                        {deltaInfo?.isBest && (
                                          <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-400">
                                            <Award size={10} />
                                            BEST
                                          </div>
                                        )}
                                      </div>
                                      {idx < row.splits.length - 1 && (
                                        <div className="w-3 h-0.5 bg-linear-to-r from-cyan-500/50 to-transparent"></div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
          races={rows.filter((r) => selectedRaces.has(r.id))}
          eventName={`${query.distance}${
            query.units === "yards" ? "Y" : "M"
          } ${captialize(query.stroke)} ${captialize(query.activity)}`}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.handleCancel}
        onConfirm={confirmDialog.handleConfirm}
        title={confirmDialog.options.title}
        message={confirmDialog.options.message}
        confirmText={confirmDialog.options.confirmText}
        cancelText={confirmDialog.options.cancelText}
        variant={confirmDialog.options.variant}
      />
    </>,
    document.body
  );
}
