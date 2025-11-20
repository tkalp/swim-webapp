// components/swimmer/bestTimes/GroupedBestTimesView.tsx
import { useMemo } from "react";
import type { BestTimeResult } from "../../../features/swimmers/bestTimesApi";
import { formatTime } from "../../../features/swimmers/bestTimesApi";
import { Clock, Activity, Edit2, TrendingDown, TrendingUp, Minus } from "lucide-react";

const STROKE_ORDER = ["free", "back", "breast", "fly", "im"] as const;
const STROKE_LABEL: Record<string, string> = {
  free: "Freestyle",
  back: "Backstroke",
  breast: "Breaststroke",
  fly: "Butterfly",
  im: "Individual Medley",
};

type StrokeGroup = {
  stroke: string;
  label: string;
  items: BestTimeResult[];
};

export default function GroupedBestTimesView({
  bestTimes,
  sortBy,
  canManageResults = true,
  onCardPress,
  onEditResult,
}: {
  bestTimes: BestTimeResult[];
  sortBy: "time" | "event" | "date";
  canManageResults?: boolean;
  onCardPress?: (item: BestTimeResult) => void;
  onEditResult?: (item: BestTimeResult) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, BestTimeResult[]>();
    bestTimes.forEach((r) => {
      const k = (r.stroke || "free").toLowerCase();
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    STROKE_ORDER.forEach((k) => {
      const arr = map.get(k);
      if (arr) {
        if (sortBy === "event") {
          arr.sort((a, b) => a.distance - b.distance || a.timeSeconds - b.timeSeconds);
        } else if (sortBy === "date") {
          arr.sort(
            (a, b) =>
              new Date(b.performedOn ?? 0).getTime() -
              new Date(a.performedOn ?? 0).getTime()
          );
        } else {
          arr.sort((a, b) => a.timeSeconds - b.timeSeconds);
        }
      }
    });
    return STROKE_ORDER
      .filter((k) => (map.get(k)?.length ?? 0) > 0)
      .map((k) => ({ stroke: k, label: STROKE_LABEL[k], items: map.get(k)! }));
  }, [bestTimes, sortBy]);

  return <TableView groups={groups} canManageResults={canManageResults} onCardPress={onCardPress} onEditResult={onEditResult} />;
}

function labelActivity(a?: string) {
  const v = (a ?? "").toLowerCase();
  if (v === "kick") return "Kick";
  if (v === "pull") return "Pull";
  return "Swim";
}

function getActivityStyles(activity?: string) {
  const v = (activity ?? "").toLowerCase();
  if (v === "kick") return "bg-gradient-to-br from-warning/20 to-warning/10 border border-warning/40 text-warning font-bold";
  if (v === "pull") return "bg-gradient-to-br from-success/20 to-success/10 border border-success/40 text-success font-bold";
  return "bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/40 text-primary font-bold";
}

function TableView({
  groups,
  canManageResults = true,
  onCardPress,
  onEditResult,
}: {
  groups: StrokeGroup[];
  canManageResults?: boolean;
  onCardPress?: (item: BestTimeResult) => void;
  onEditResult?: (item: BestTimeResult) => void;
}) {
  // Check if we have any SCY results
  const hasScyResults = groups.some(g => g.items.some(item => item.resultUnits === 'SCY'));
  
  // Group items by distance/activity/equipment within each stroke
  const groupedData = groups.map(group => {
    const eventMap = new Map<string, { distance: number; activity: string; equipment: string; items: BestTimeResult[] }>();
    
    group.items.forEach(item => {
      const key = `${item.distance}-${item.activity}-${item.equipment}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, {
          distance: item.distance,
          activity: item.activity,
          equipment: item.equipment,
          items: []
        });
      }
      eventMap.get(key)!.items.push(item);
    });
        
    return {
      ...group,
      events: Array.from(eventMap.values()).sort((a, b) => a.distance - b.distance)
    };
  });

  return (
    <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-background-elevated/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Event</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Trend</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">SCM</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">LCM</th>
              {hasScyResults && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">SCY</th>
              )}
              <th className="text-right px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupedData.map((group) => (
              <>
                <tr key={`header-${group.stroke}`} className="bg-background-secondary/30">
                  <td colSpan={hasScyResults ? 7 : 6} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-primary" />
                      <span className="text-sm font-semibold text-text-primary">{group.label}</span>
                      <span className="text-xs text-text-tertiary">({group.events.length} events)</span>
                    </div>
                  </td>
                </tr>
                {group.events.map((event) => {
                  const scmItem = event.items.find(i => i.resultUnits === 'SCM');
                  const lcmItem = event.items.find(i => i.resultUnits === 'LCM');
                  const scyItem = event.items.find(i => i.resultUnits === 'SCY');
                  const anyItem = scmItem || lcmItem || scyItem!;
                  
                  return (
                    <tr 
                      key={`${group.stroke}-${event.distance}-${event.activity}-${event.equipment}`}
                      className="border-b border-border/30 hover:bg-background-elevated/50 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-bold text-text-primary">{event.distance}</span>
                          <span className="text-xs text-text-muted uppercase">
                            {anyItem.units === "yards" ? "yd" : "m"}
                          </span>
                          <span className="text-sm text-text-secondary ml-1">{STROKE_LABEL[anyItem.stroke] ?? anyItem.stroke}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ` + getActivityStyles(event.activity)}>
                            {labelActivity(event.activity)}
                          </span>
                          {event.equipment !== "none" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-background-secondary border border-border/50 text-text-muted text-xs">
                              {event.equipment}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Trend Column */}
                      <td className="px-4 py-3">
                        {anyItem.recentTrend ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background-secondary/50">
                            <div className={`${
                              anyItem.recentTrend.improving 
                                ? 'text-emerald-500' 
                                : anyItem.recentTrend.declining 
                                ? 'text-rose-500'
                                : 'text-slate-400'
                            }`}>
                              {anyItem.recentTrend.improving && <TrendingDown size={14} />}
                              {anyItem.recentTrend.declining && <TrendingUp size={14} />}
                              {anyItem.recentTrend.stable && <Minus size={14} />}
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-xs font-medium ${
                                anyItem.recentTrend.improving 
                                  ? 'text-emerald-500' 
                                  : anyItem.recentTrend.declining 
                                  ? 'text-rose-500'
                                  : 'text-slate-400'
                              }`}>
                                {anyItem.recentTrend.improving && `${Math.abs(anyItem.recentTrend.delta).toFixed(1)}s`}
                                {anyItem.recentTrend.declining && `${Math.abs(anyItem.recentTrend.delta).toFixed(1)}s`}
                                {anyItem.recentTrend.stable && 'Stable'}
                              </span>
                              {!anyItem.recentTrend.stable && (
                                <span className={`text-[10px] ${
                                  anyItem.recentTrend.improving 
                                    ? 'text-emerald-500/70' 
                                    : 'text-rose-500/70'
                                }`}>
                                  {anyItem.recentTrend.percentage >= 0 ? '+' : ''}{anyItem.recentTrend.percentage}%
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-tertiary text-xs">—</span>
                        )}
                      </td>
                      
                      {/* SCM Column */}
                      <td className="px-4 py-3">
                        {scmItem ? (
                          <button
                            onClick={() => onCardPress?.(scmItem)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg hover:from-primary/20 hover:to-accent/20 hover:border-primary/40 transition-all"
                          >
                            <Clock size={14} className="text-primary" />
                            <span className="text-base font-bold text-primary">
                              {formatTime(scmItem.timeSeconds)}
                            </span>
                          </button>
                        ) : (
                          <span className="text-text-tertiary text-sm">—</span>
                        )}
                      </td>
                      
                      {/* LCM Column */}
                      <td className="px-4 py-3">
                        {lcmItem ? (
                          <button
                            onClick={() => onCardPress?.(lcmItem)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg hover:from-primary/20 hover:to-accent/20 hover:border-primary/40 transition-all"
                          >
                            <Clock size={14} className="text-primary" />
                            <span className="text-base font-bold text-primary">
                              {formatTime(lcmItem.timeSeconds)}
                            </span>
                          </button>
                        ) : (
                          <span className="text-text-tertiary text-sm">—</span>
                        )}
                      </td>
                      
                      {/* SCY Column (conditional) */}
                      {hasScyResults && (
                        <td className="px-4 py-3">
                          {scyItem ? (
                            <button
                              onClick={() => onCardPress?.(scyItem)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg hover:from-primary/20 hover:to-accent/20 hover:border-primary/40 transition-all"
                            >
                              <Clock size={14} className="text-primary" />
                              <span className="text-base font-bold text-primary">
                                {formatTime(scyItem.timeSeconds)}
                              </span>
                            </button>
                          ) : (
                            <span className="text-text-tertiary text-sm">—</span>
                          )}
                        </td>
                      )}
                      
                      {/* Actions Column */}
                      <td className="px-4 py-3">
                        {canManageResults && (
                          <div className="flex justify-end gap-1">
                            {scmItem && onEditResult && (
                              <button
                                onClick={() => onEditResult(scmItem)}
                                className="p-2 rounded-lg bg-background-elevated border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent transition-all duration-200 hover:scale-105 opacity-0 group-hover:opacity-100"
                                title="Edit SCM result"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {lcmItem && onEditResult && (
                              <button
                                onClick={() => onEditResult(lcmItem)}
                                className="p-2 rounded-lg bg-background-elevated border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent transition-all duration-200 hover:scale-105 opacity-0 group-hover:opacity-100"
                                title="Edit LCM result"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                            {scyItem && onEditResult && (
                              <button
                                onClick={() => onEditResult(scyItem)}
                                className="p-2 rounded-lg bg-background-elevated border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent transition-all duration-200 hover:scale-105 opacity-0 group-hover:opacity-100"
                                title="Edit SCY result"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
