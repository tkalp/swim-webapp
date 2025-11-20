import { useEffect, useState } from "react";
import {
  getSquadAttendanceStats,
  getSquadDistancePerWeek,
  getSquadStrokeBreakdown,
  getSquadActivityBreakdown,
  getSquadSessionCount,
  getSquadTotalMeters,
  type StrokeBreakdown,
  type ActivityBreakdown,
} from '@/services/metricsService';

import DistancePerWeekChart from '@/components/charts/WeeklyDistanceChart';
import BreakdownChart from '@/components/charts/BreakdownChart';
import DateInput from '@/components/ui/DateInput';
import { SquadPageHeader } from '@/components/squad/SquadPageHeader';
import { Waves, Zap, Calendar, TrendingUp, Users, Check, Activity } from "lucide-react";

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
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [totalMeters, setTotalMeters] = useState<number>(0);
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
        const [a, d, s, ac, sc, tm] = await Promise.all([
          getSquadAttendanceStats(squadId, { from, to }),
          getSquadDistancePerWeek(squadId, { from, to }),
          getSquadStrokeBreakdown(squadId, { from, to }),
          getSquadActivityBreakdown(squadId, { from, to }),
          getSquadSessionCount(squadId, { from, to }),
          getSquadTotalMeters(squadId, { from, to }),
        ]);
        if (!mounted) return;
        setAtt(a);
        setDist(d);
        setStrokeData(s);
        setActivityData(ac);
        setSessionCount(sc);
        setTotalMeters(tm);
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Hero Header Section */}
      <SquadPageHeader
        title="Squad Analytics"
        subtitle="Performance insights and training metrics for your squad"
        actions={
          !loading && att ? (
            <>
              <div className="px-4 py-2.5 bg-success/10 border border-success/30 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-xs text-success/80 font-medium mb-0.5">Attendance Rate</div>
                <div className="text-xl font-bold text-success">
                  {att.present + att.late + att.absent > 0 
                    ? Math.round((att.present / (att.present + att.late + att.absent)) * 100)
                    : 0}%
                </div>
              </div>
              <div className="px-4 py-2.5 bg-warning/10 border border-warning/30 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-xs text-warning/80 font-medium mb-0.5">Total Distance</div>
                <div className="text-xl font-bold text-warning">
                  {totalMeters.toLocaleString()}m
                </div>
              </div>
              <div className="px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-xs text-primary/80 font-medium mb-0.5">Total Sessions</div>
                <div className="text-xl font-bold text-primary">
                  {sessionCount.toLocaleString()}
                </div>
              </div>
            </>
          ) : undefined
        }
      />

      {/* Date Range Selector - Redesigned */}
      <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 relative z-50 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-linear-to-br from-accent to-primary rounded-xl flex items-center justify-center shadow-lg shadow-accent/25">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Time Period</h3>
            <p className="text-xs text-text-secondary">Filter your squad data by date range</p>
          </div>
        </div>
        
        {/* Quick Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { key: "this_week" as const, label: "This Week" },
            { key: "last_week" as const, label: "Last Week" },
            { key: "this_month" as const, label: "This Month" },
            { key: "last_month" as const, label: "Last Month" },
            { key: "all_time" as const, label: "All Time" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 ${
                rangeKey === key
                  ? "bg-linear-to-r from-primary to-accent text-white shadow-md"
                  : "bg-background-tertiary/60 text-text-secondary hover:bg-background-secondary hover:text-text-primary border border-border/40"
              }`}
              onClick={() => onQuick(key)}
            >
              {label}
            </button>
          ))}
          
          {/* Inline Custom Date Range */}
          <div className="flex items-center gap-2 ml-2">
            <DateInput
              label=""
              value={from ? from.slice(0, 10) : ""}
              onChange={(value) => setFrom(value ? new Date(value).toISOString() : undefined)}
              placeholder="From"
            />
            <span className="text-text-secondary text-xs">to</span>
            <DateInput
              label=""
              value={to ? to.slice(0, 10) : ""}
              onChange={(value) => setTo(value ? new Date(value + "T23:59:59").toISOString() : undefined)}
              placeholder="To"
            />
            <button
              className="px-3 py-1.5 bg-accent text-white font-medium text-xs rounded-lg hover:bg-accent/90 transition-all"
              onClick={onApplyCustom}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
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
        <div className="flex flex-col md:flex-row md:flex-wrap xl:flex-nowrap gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 md:w-[calc(50%-10px)] xl:w-auto bg-background-elevated rounded-xl border border-border/60 p-5 sm:p-6 shadow-lg animate-pulse">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-background-tertiary rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-background-tertiary rounded-lg mb-2 w-24"></div>
                </div>
              </div>
              <div className="h-56 sm:h-64 bg-background-tertiary rounded-lg"></div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Section */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {/* Weekly Distance Chart */}
          <div className="w-full group bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-8 backdrop-blur-sm shadow-xl hover:shadow-2xl hover:border-primary/40 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-linear-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-text-primary">Weekly Distance</h3>
                  <p className="text-sm text-text-secondary">Training volume over time</p>
                </div>
              </div>
              <DistancePerWeekChart
                title=""
                subtitle=""
                dist={dist}
              />
            </div>
          </div>

          {/* Stroke Distribution */}
          <div className="w-full group bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-8 backdrop-blur-sm shadow-xl hover:shadow-2xl hover:border-accent/40 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-linear-to-br from-accent/20 to-accent/5 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Waves className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-text-primary">Stroke Distribution</h3>
                  <p className="text-sm text-text-secondary">By stroke type</p>
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

          {/* Activity Mix */}
          <div className="w-full group bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-8 backdrop-blur-sm shadow-xl hover:shadow-2xl hover:border-warning/40 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-linear-to-br from-warning/20 to-warning/5 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-6 h-6 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-text-primary">Activity Mix</h3>
                  <p className="text-sm text-text-secondary">Training intensity breakdown</p>
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
