import { useEffect, useState } from "react";
import {
  getSquadAttendanceStats,
  getSquadDistancePerWeek,
  getSquadStrokeBreakdown,
  getSquadActivityBreakdown,
  type StrokeBreakdown,
  type ActivityBreakdown,
} from "../../features/squads/metricsApi";
import AttendanceChart from "../charts/AttendanceChart";
import DistancePerWeekChart from "../charts/WeeklyDistanceChart";
import BreakdownChart from "../charts/BreakdownChart";
import DateInput from "../ui/DateInput";
import { Waves, Zap, Calendar, TrendingUp, Users, Check } from "lucide-react";

export type RangeKey =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "all_time"
  | "custom";

function startOfWeek(d = new Date()) {
  const n = new Date(d);
  const day = n.getDay();
  n.setHours(0, 0, 0, 0);
  n.setDate(n.getDate() - day);
  return n;
}

function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function shiftMonth(d = new Date(), delta = 0) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
}

function presetRange(key: RangeKey) {
  const now = new Date();
  if (key === "this_week")
    return {
      from: startOfWeek(now).toISOString(),
      to: endOfWeek(now).toISOString(),
    };
  if (key === "last_week") {
    const last = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return {
      from: startOfWeek(last).toISOString(),
      to: endOfWeek(last).toISOString(),
    };
  }
  if (key === "this_month")
    return {
      from: startOfMonth(now).toISOString(),
      to: endOfMonth(now).toISOString(),
    };
  if (key === "last_month") {
    const base = shiftMonth(now, -1);
    return {
      from: startOfMonth(base).toISOString(),
      to: endOfMonth(base).toISOString(),
    };
  }
  if (key === "all_time") return { from: undefined, to: undefined };
  return {};
}

export default function SquadMetricsTab({ squadId }: { squadId: string }) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("all_time");
  const init = presetRange("all_time");
  const [from, setFrom] = useState<string | undefined>(init.from);
  const [to, setTo] = useState<string | undefined>(init.to);

  const [att, setAtt] = useState<{
    present: number;
    late: number;
    absent: number;
  } | null>(null);
  const [dist, setDist] = useState<{ week: string; meters: number }[]>([]);
  const [strokeData, setStrokeData] = useState<StrokeBreakdown[]>([]);
  const [activityData, setActivityData] = useState<ActivityBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const [a, d, s, ac] = await Promise.all([
          getSquadAttendanceStats(squadId, { from, to }),
          getSquadDistancePerWeek(squadId, { from, to }),
          getSquadStrokeBreakdown(squadId, { from, to }),
          getSquadActivityBreakdown(squadId, { from, to }),
        ]);
        if (!mounted) return;
        setAtt(a);
        setDist(d);
        setStrokeData(s);
        setActivityData(ac);
        setErr("");
      } catch (e: any) {
        if (mounted) setErr(e.message ?? "Failed to load squad metrics");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [squadId, from, to]);

  const onQuick = (k: RangeKey) => {
    setRangeKey(k);
    const p = presetRange(k);
    setFrom(p.from);
    setTo(p.to);
  };

  const onApplyCustom = () => setRangeKey("custom");

  const attData = [
    { label: "Present", value: att?.present ?? 0, color: "#10B981" },
    { label: "Late", value: att?.late ?? 0, color: "#F59E0B" },
    { label: "Absent", value: att?.absent ?? 0, color: "#EF4444" },
  ];

  const rangeSubtitle = formatRangeSubtitle(from, to);

  return (
    <div className="flex flex-col gap-3 p-4 min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-1">
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">Squad Metrics</h2>
        <p className="text-text-secondary text-xs">Track performance, attendance, and training statistics</p>
      </div>

      {/* Modern Range Selector */}
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 relative z-50">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center shadow-md shadow-accent/25">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Date Range</h3>
            <p className="text-xs text-text-tertiary">Select a time period</p>
          </div>
        </div>
        
        {/* Quick Preset Buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { key: "this_week" as const, label: "This Week" },
            { key: "last_week" as const, label: "Last Week" },
            { key: "this_month" as const, label: "This Month" },
            { key: "last_month" as const, label: "Last Month" },
            { key: "all_time" as const, label: "All Time" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`group px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 hover:scale-105 active:scale-95 ${
                rangeKey === key
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30 ring-2 ring-primary/50"
                  : "bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary hover:shadow-sm border border-border/30"
              }`}
              onClick={() => onQuick(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <div className="flex flex-wrap items-end gap-3 relative z-50 p-3 bg-background-tertiary/30 rounded-lg border border-border/30">
          <div className="flex-1 min-w-[150px] relative z-50">
            <DateInput
              label="From Date"
              value={from ? from.slice(0, 10) : ""}
              onChange={(value) => setFrom(value ? new Date(value).toISOString() : undefined)}
              placeholder="Select start date"
            />
          </div>
          <div className="flex-1 min-w-[150px] relative z-50">
            <DateInput
              label="To Date"
              value={to ? to.slice(0, 10) : ""}
              onChange={(value) => setTo(value ? new Date(value + "T23:59:59").toISOString() : undefined)}
              placeholder="Select end date"
            />
          </div>
          <button
            className="px-4 py-2 bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white font-semibold text-xs rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg shadow-accent/25 flex items-center gap-1.5"
            onClick={onApplyCustom}
          >
            <Check className="w-3 h-3" />
            Apply
          </button>
        </div>
      </div>

      {/* Error Message */}
      {err && (
        <div className="bg-danger/10 border-l-4 border-danger rounded-lg p-3 backdrop-blur-sm shadow-md animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 bg-danger/20 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-danger font-semibold text-sm mb-0.5">Error Loading Metrics</h4>
              <p className="text-danger/80 text-xs">{err}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col xl:flex-row gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 bg-background-elevated rounded-xl border border-border/60 p-4 shadow-lg animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-background-tertiary rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-background-tertiary rounded-lg mb-2 w-20"></div>
                </div>
              </div>
              <div className="h-64 bg-background-tertiary rounded-lg"></div>
            </div>
          ))}
        </div>
      )}

      {/* Charts - All 4 in a single row */}
      {!loading && (
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Attendance Chart */}
          <div className="flex-1 group bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-success/20 to-success/5 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-4 h-4 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">Attendance</h3>
                </div>
              </div>
              <AttendanceChart data={attData} subtitle="" />
            </div>
          </div>

          {/* Distance Chart */}
          <div className="flex-1 group bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">Weekly Distance</h3>
                </div>
              </div>
              <DistancePerWeekChart
                title=""
                subtitle=""
                dist={dist}
              />
            </div>
          </div>

          {/* Stroke Breakdown Chart */}
          <div className="flex-1 group bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-accent/30 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Waves size={16} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">Stroke</h3>
                </div>
              </div>
              <BreakdownChart
                data={strokeData.map(item => ({
                  name: item.stroke,
                  value: item.meters,
                  color: item.color
                }))}
                title=""
                subtitle=""
                icon={<Waves size={20} />}
              />
            </div>
          </div>

          {/* Activity Breakdown Chart */}
          <div className="flex-1 group bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-warning/30 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-warning/20 to-warning/5 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Zap size={16} className="text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">Activity</h3>
                </div>
              </div>
              <BreakdownChart
                data={activityData.map(item => ({
                  name: item.activity,
                  value: item.meters,
                  color: item.color
                }))}
                title=""
                subtitle=""
                icon={<Zap size={20} />}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRangeSubtitle(from?: string, to?: string) {
  if (!from && !to) return "All time";
  const f = from ? new Date(from) : undefined;
  const t = to ? new Date(to) : undefined;
  const fmt = (d: Date) =>
    d.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  if (f && t) return `${fmt(f)} – ${fmt(t)}`;
  if (f) return `Since ${fmt(f)}`;
  if (t) return `Until ${fmt(t)}`;
  return "";
}
