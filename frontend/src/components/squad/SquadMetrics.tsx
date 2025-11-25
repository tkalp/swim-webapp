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
import { SquadTabHeader } from '@/components/squad/SquadTabHeader';
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-linear-to-br from-slate-950/50 via-transparent to-slate-950/50">
      {/* Page Header */}
      <SquadTabHeader
        title="Squad Metrics"
        subtitle="Overview of squad performance and activity"
      />
      {/* Date Range Selector */}
      <div className="mb-6">
        {/* Compact Date Range Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Presets */}
          {[
            { key: "this_week" as const, label: "This Week" },
            { key: "last_week" as const, label: "Last Week" },
            { key: "this_month" as const, label: "This Month" },
            { key: "last_month" as const, label: "Last Month" },
            { key: "all_time" as const, label: "All Time" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all duration-200 ${
                rangeKey === key
                  ? "bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30 scale-105"
                  : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 hover:scale-105 border border-slate-700/40"
              }`}
              onClick={() => onQuick(key)}
            >
              {label}
            </button>
          ))}
          
          {/* Divider */}
          <div className="h-8 w-px bg-slate-700/40"></div>
          
          {/* Custom Date Range */}
          <div className="flex items-center gap-2">
            <DateInput
              label=""
              value={from ? from.slice(0, 10) : ""}
              onChange={(value) => setFrom(value ? new Date(value).toISOString() : undefined)}
              placeholder="Start"
            />
            <span className="text-slate-500 font-medium text-sm">→</span>
            <DateInput
              label=""
              value={to ? to.slice(0, 10) : ""}
              onChange={(value) => setTo(value ? new Date(value + "T23:59:59").toISOString() : undefined)}
              placeholder="End"
            />
            <button
              className="px-2 py-1.5 bg-linear-to-r from-cyan-500 to-blue-500 text-white font-semibold text-xs rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all shrink-0"
              onClick={onApplyCustom}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Vibrant Hero Stats Cards */}
      {!loading && att && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Attendance Rate Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500/10 to-green-500/10 border-2 border-emerald-500/20 p-6 hover:border-emerald-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-xs font-bold text-emerald-400/60 uppercase tracking-wider">Success</div>
              </div>
              <div className="text-sm text-emerald-300/80 font-medium mb-1">Attendance Rate</div>
              <div className="text-4xl font-black bg-linear-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                {att.present + att.late + att.absent > 0 
                  ? Math.round((att.present / (att.present + att.late + att.absent)) * 100)
                  : 0}%
              </div>
              <div className="mt-3 h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-linear-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-1000"
                  style={{ width: `${att.present + att.late + att.absent > 0 ? Math.round((att.present / (att.present + att.late + att.absent)) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Total Distance Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/20 p-6 hover:border-cyan-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Waves className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-xs font-bold text-cyan-400/60 uppercase tracking-wider">Distance</div>
              </div>
              <div className="text-sm text-cyan-300/80 font-medium mb-1">Total Meters</div>
              <div className="text-4xl font-black bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {(totalMeters / 1000).toFixed(1)}K
              </div>
              <div className="mt-2 text-xs text-cyan-300/60">
                {totalMeters.toLocaleString()} meters
              </div>
            </div>
          </div>

          {/* Total Sessions Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-linear-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/20 p-6 hover:border-purple-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Activity className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-xs font-bold text-purple-400/60 uppercase tracking-wider">Sessions</div>
              </div>
              <div className="text-sm text-purple-300/80 font-medium mb-1">Training Sessions</div>
              <div className="text-4xl font-black bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {sessionCount}
              </div>
              <div className="mt-2 text-xs text-purple-300/60">
                Total completed
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div key={i} className="flex-1 md:w-[calc(50%-10px)] xl:w-auto bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-5 sm:p-6 shadow-lg animate-pulse">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-slate-800/60 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-800/60 rounded-lg mb-2 w-24"></div>
                </div>
              </div>
              <div className="h-56 sm:h-64 bg-slate-800/60 rounded-lg"></div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Section - Enhanced with vibrant gradients */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {/* Weekly Distance Chart */}
          <div className="w-full group relative overflow-hidden rounded-2xl bg-linear-to-br from-cyan-500/5 via-slate-900/80 to-blue-500/5 border-2 border-cyan-500/20 p-6 backdrop-blur-sm hover:shadow-2xl hover:shadow-cyan-500/10 hover:border-cyan-500/40 transition-all duration-300 hover:scale-[1.02]">
            {/* Animated glow effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all duration-500" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500 delay-100" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Weekly Distance</h3>
                  <p className="text-xs text-slate-400">Training volume over time</p>
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
          <div className="w-full group relative overflow-hidden rounded-2xl bg-linear-to-br from-purple-500/5 via-slate-900/80 to-pink-500/5 border-2 border-purple-500/20 p-6 backdrop-blur-sm hover:shadow-2xl hover:shadow-purple-500/10 hover:border-purple-500/40 transition-all duration-300 hover:scale-[1.02]">
            {/* Animated glow effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl group-hover:bg-pink-500/20 transition-all duration-500 delay-100" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-linear-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/30 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Waves className="w-6 h-6 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Stroke Distribution</h3>
                  <p className="text-xs text-slate-400">By stroke type</p>
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
          <div className="w-full group relative overflow-hidden rounded-2xl bg-linear-to-br from-orange-500/5 via-slate-900/80 to-amber-500/5 border-2 border-orange-500/20 p-6 backdrop-blur-sm hover:shadow-2xl hover:shadow-orange-500/10 hover:border-orange-500/40 transition-all duration-300 hover:scale-[1.02]">
            {/* Animated glow effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all duration-500" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all duration-500 delay-100" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-linear-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-6 h-6 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.3)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold bg-linear-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Activity Mix</h3>
                  <p className="text-xs text-slate-400">Training intensity breakdown</p>
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

