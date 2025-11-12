import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getEventAttempts,
  type EventQuery,
  formatTime,
  intervalToSeconds,
  type RaceSplit,
} from "../../../features/swimmers/bestTimesApi";
import AttemptsStats from "./AttemptsStats";
import AttemptsChart from "./AttemptsChart";
import { X, AlertCircle, Activity, Edit2, Calendar, Clock, ChevronDown, ChevronRight } from "lucide-react";

export default function AttemptsModal({
  open,
  onClose,
  query,
  onEditAttempt,
}: {
  open: boolean;
  onClose: () => void;
  query: EventQuery;
  onEditAttempt?: (attemptId: string) => void;
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

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const r = await getEventAttempts(query);
        if (!mounted) return;
        // Store unsorted for chart (temporal order)
        setRows(r);
        setErr("");
      } catch (e: any) {
        setErr(e.message ?? "Failed to load attempts");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, query]);

  // Chart data - temporal order (as received)
  const data = useMemo(
    () =>
      rows.map((r, i) => ({
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
    [rows]
  );

  // Table data - sorted by performance (fastest first)
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.timeSeconds - b.timeSeconds),
    [rows]
  );

  const first = rows[0]?.timeSeconds;
  const last = rows[rows.length - 1]?.timeSeconds;
  const best = rows.reduce(
    (m, r) => (r.timeSeconds < m ? r.timeSeconds : m),
    Number.POSITIVE_INFINITY
  );
  const improvedPct =
    first && last ? Math.round(((first - last) / first) * 100) : 0;

  // Calculate recent trend (last 3-5 attempts)
  const recentTrend = useMemo(() => {
    if (rows.length < 2) return null;
    
    const recentCount = Math.min(5, rows.length);
    const recentResults = rows.slice(-recentCount); // Get last 3-5 results
    
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
  }, [rows]);

  if (!open) return null;

  const captialize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-background-secondary border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom duration-300"
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
            {query.equipment !== "none" && (
              <p className="text-text-secondary text-sm">
                Equipment:{" "}
                <span className="font-semibold text-primary">
                  {query.equipment}
                </span>
              </p>
            )}
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

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] bg-background-elevated border-2 border-dashed border-border rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary mb-4">
                <Activity size={32} />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No Attempts Yet
              </h3>
              <p className="text-text-muted">
                No attempts have been recorded for this event.
              </p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-500 delay-200">
              <AttemptsStats
                recentTrend={recentTrend}
                best={best}
                totalAttempts={rows.length}
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
                    {rows.length} {rows.length === 1 ? "attempt" : "attempts"}{" "}
                    recorded
                  </p>
                </div>
                
                {/* Table format for better readability with many attempts */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background-secondary/30 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider w-8"></th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Rank</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Time</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Splits</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedRows.map((row, index) => {
                        const isBest = row.timeSeconds === best;
                        const isExpanded = expandedRows.has(row.id);
                        const hasSplits = row.splits && row.splits.length > 0;
                        
                        return (
                          <>
                            <tr
                              key={row.id}
                              className={`hover:bg-background-secondary/50 transition-colors ${isBest ? 'bg-primary/5' : ''}`}
                            >
                              {/* Expand button */}
                              <td className="px-2 py-3">
                                {hasSplits && (
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedRows);
                                      if (isExpanded) {
                                        newExpanded.delete(row.id);
                                      } else {
                                        newExpanded.add(row.id);
                                      }
                                      setExpandedRows(newExpanded);
                                    }}
                                    className="p-1 hover:bg-background-tertiary rounded transition-colors"
                                    title={isExpanded ? "Collapse splits" : "Expand splits"}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown size={16} className="text-text-muted" />
                                    ) : (
                                      <ChevronRight size={16} className="text-text-muted" />
                                    )}
                                  </button>
                                )}
                              </td>

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

                              {/* Splits indicator */}
                              <td className="px-4 py-3">
                                {hasSplits ? (
                                  <span className="text-xs text-text-secondary">
                                    {row.splits.length} {row.splits.length === 1 ? 'split' : 'splits'}
                                  </span>
                                ) : (
                                  <span className="text-xs text-text-tertiary">—</span>
                                )}
                              </td>

                              {/* Edit button */}
                              <td className="px-4 py-3">
                                <div className="flex justify-end">
                                  {onEditAttempt && (
                                    <button
                                      onClick={() => onEditAttempt(row.id)}
                                      className="p-2 rounded-lg bg-background-tertiary border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent transition-all duration-200 hover:scale-105"
                                      title="Edit attempt"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            
                            {/* Expanded splits row */}
                            {isExpanded && hasSplits && (
                              <tr key={`${row.id}-splits`} className="bg-background-elevated/30">
                                <td colSpan={6} className="px-4 py-3">
                                  <div className="pl-12 pr-4">
                                    <div className="flex items-center gap-4 flex-wrap">
                                      {row.splits.map((split, idx) => (
                                        <div key={split.id} className="flex items-center gap-2">
                                          <div className="flex items-baseline gap-1.5">
                                            <span className="text-xs font-medium text-primary">
                                              {split.split_distance}m
                                            </span>
                                            <span className="text-sm font-mono font-semibold text-text-primary">
                                              {formatTime(intervalToSeconds(split.split_time))}
                                            </span>
                                            <span className="text-xs text-text-tertiary">
                                              ({formatTime(intervalToSeconds(split.cumulative_time))})
                                            </span>
                                          </div>
                                          {idx < row.splits.length - 1 && (
                                            <span className="text-text-tertiary">•</span>
                                          )}
                                        </div>
                                      ))}
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

  return createPortal(modalContent, document.body);
}
