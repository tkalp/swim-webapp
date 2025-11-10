// components/swimmer/bestTimes/GroupedBestTimesView.tsx
import { useMemo, useState } from "react";
import type { BestTimeResult } from "../../../features/swimmers/bestTimesApi";
import { formatTime } from "../../../features/swimmers/bestTimesApi";
import { ChevronRight, Clock, Calendar, Activity, Edit2 } from "lucide-react";

const STROKE_ORDER = ["free", "back", "breast", "fly", "im"] as const;
const STROKE_LABEL: Record<string, string> = {
  free: "Freestyle",
  back: "Backstroke",
  breast: "Breaststroke",
  fly: "Butterfly",
  im: "Individual Medley",
};

export default function GroupedBestTimesView({
  bestTimes,
  sortBy,
  onCardPress,
  onEditResult,
}: {
  bestTimes: BestTimeResult[];
  sortBy: "time" | "event" | "date";
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

  return (
    <div className="space-y-6">
      {groups.map((g, index) => (
        <div 
          key={g.stroke}
          className="animate-in fade-in slide-in-from-bottom duration-500"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <StrokeSection
            label={g.label}
            items={g.items}
            onCardPress={onCardPress}
            onEditResult={onEditResult}
          />
        </div>
      ))}
    </div>
  );
}

function StrokeSection({
  label,
  items,
  onCardPress,
  onEditResult,
}: {
  label: string;
  items: BestTimeResult[];
  onCardPress?: (item: BestTimeResult) => void;
  onEditResult?: (item: BestTimeResult) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl shadow-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-background-elevated/50 transition-all duration-200 border-b border-border/50 group"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-md shadow-accent/25">
            <Activity size={16} className="text-white" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
          <span className="text-xs text-text-tertiary">
            {items.length} {items.length === 1 ? 'record' : 'records'}
          </span>
        </div>
        <ChevronRight 
          className={`text-text-muted transition-all duration-200 group-hover:text-primary ${open ? 'rotate-90' : ''}`} 
          size={18} 
        />
      </button>

      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 space-y-2">
          {items.map((it) => (
            <div
              key={it.eventKey}
              className="w-full bg-background-tertiary/50 border border-border/50 rounded-lg p-3 hover:bg-background-elevated hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Distance, stroke, and tags */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-text-primary">{it.distance}</span>
                    <span className="text-xs text-text-muted uppercase">
                      {it.units === "yards" ? "yd" : "m"}
                    </span>
                  </div>
                  <span className="text-sm text-text-secondary">
                    {STROKE_LABEL[it.stroke] ?? it.stroke}
                  </span>
                  
                  <div className="flex flex-wrap gap-1.5 ml-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActivityStyles(it.activity)}`}>
                      {labelActivity(it.activity)}
                    </span>
                    {it.equipment !== "none" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-background-secondary border border-border/50 text-text-muted text-xs">
                        {it.equipment}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Time, date, and actions */}
                <div className="flex items-center gap-3">
                  {it.performedOn && (
                    <div className="flex items-center gap-1.5 text-text-tertiary text-xs">
                      <Calendar size={12} />
                      <span>
                        {new Date(it.performedOn).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  
                  <button
                    onClick={() => onCardPress?.(it)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg hover:from-primary/20 hover:to-accent/20 hover:border-primary/40 transition-all"
                  >
                    <Clock size={14} className="text-primary" />
                    <span className="text-lg font-bold text-primary">
                      {formatTime(it.timeSeconds)}
                    </span>
                  </button>

                  {onEditResult && (
                    <button
                      onClick={() => onEditResult(it)}
                      className="p-2 rounded-lg bg-background-elevated border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent transition-all duration-200 hover:scale-105"
                      title="Edit result"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function activityClass(a?: string) {
  const v = (a ?? "").toLowerCase();
  if (v === "kick") return "kick";
  if (v === "pull") return "pull";
  return "swim";
}

function labelActivity(a?: string) {
  const v = (a ?? "").toLowerCase();
  if (v === "kick") return "Kick";
  if (v === "pull") return "Pull";
  return "Swim";
}

function getActivityStyles(activity?: string) {
  const activityType = activityClass(activity);
  switch (activityType) {
    case "kick":
      return "bg-gradient-to-br from-warning/20 to-warning/10 border border-warning/40 text-warning font-bold";
    case "pull":
      return "bg-gradient-to-br from-success/20 to-success/10 border border-success/40 text-success font-bold";
    default:
      return "bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/40 text-primary font-bold";
  }
}