import { useState, useMemo } from 'react';
import type { WorkoutAnalysis } from '@/services/workoutAnalysisService';
import { BarChart3, Waves, Clock, ChevronDown, ChevronUp, Activity, Zap, Loader2 } from 'lucide-react';

const STROKE_ICONS: Record<string, string> = {
  freestyle: '/images/freestyle.png',
  backstroke: '/images/backstroke.png',
  breaststroke: '/images/breastroke.png', // filename typo in assets
  butterfly: '/images/butterfly.png',
  im: '/images/im.png',
};

const STROKE_LABELS: Record<string, string> = {
  freestyle: 'Freestyle',
  backstroke: 'Backstroke',
  breaststroke: 'Breaststroke',
  butterfly: 'Butterfly',
  im: 'IM',
  choice: 'Choice',
};

const ZONE_LABELS: Record<string, string> = {
  en1: 'EN1',
  en2: 'EN2',
  en3: 'EN3',
  en4: 'EN4',
  sprint: 'Sprint',
};

const ZONE_COLORS: Record<string, string> = {
  en1: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  en2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  en3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  en4: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  sprint: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STROKE_COLORS: Record<string, { bg: string; solid: string; glow: string }> = {
  freestyle: { bg: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)', solid: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)' },
  backstroke: { bg: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)', solid: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  breaststroke: { bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', solid: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  butterfly: { bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', solid: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  im: { bg: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', solid: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  choice: { bg: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)', solid: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)' },
};

const ACTIVITY_COLORS: Record<string, { bg: string; solid: string; glow: string }> = {
  swim: { bg: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)', solid: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)' },
  kick: { bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', solid: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  pull: { bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', solid: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  drill: { bg: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)', solid: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
};

const DEFAULT_COLOR = { bg: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)', solid: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)' };

function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded >= 60) {
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${rounded}m`;
}

interface Props {
  analysis: WorkoutAnalysis | null;
  isStale?: boolean;
  isLoading?: boolean;
}

export function WorkoutMetricsCard({ analysis, isStale, isLoading }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const sortedStrokes = useMemo(() => {
    if (!analysis) return [];
    return Object.entries(analysis.stroke_breakdown)
      .sort(([, a], [, b]) => b.meters - a.meters);
  }, [analysis]);

  const sortedActivities = useMemo(() => {
    if (!analysis) return [];
    return Object.entries(analysis.activity_breakdown)
      .sort(([, a], [, b]) => b.meters - a.meters);
  }, [analysis]);

  if (!analysis) return null;

  const summaryText = [
    analysis.parser_used === 'llm' ? 'AI Parsed' : 'Regex',
    `${analysis.total_meters}m`,
    formatDuration(analysis.estimated_duration_minutes),
  ].join(' \u00b7 ');

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 shadow-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-100">Workout Analysis</h3>
            {collapsed && (
              <p className="text-xs text-slate-400 mt-0.5">{summaryText}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 size={16} className="text-cyan-400 animate-spin" />}
          {isStale && (
            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5">
              Stale
            </span>
          )}
          {collapsed ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronUp size={18} className="text-slate-400" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-5">
          {/* Notices */}
          {analysis.parser_used === 'regex' && (
            <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
              Analysis is approximate — AI parser unavailable
            </div>
          )}

          {/* Key Metrics - 2 col grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Distance */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Waves size={16} className="text-cyan-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Distance</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">{analysis.total_meters.toLocaleString()}m</div>
              <div className="text-xs text-slate-500 mt-1">{analysis.total_sets} sets</div>
            </div>
            {/* Duration */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-emerald-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Duration</span>
              </div>
              <div className="text-2xl font-bold text-slate-100">{formatDuration(analysis.estimated_duration_minutes)}</div>
              <div className="text-xs text-slate-500 mt-1">
                {analysis.rest_time_minutes > 0
                  ? `includes ${formatDuration(analysis.rest_time_minutes)} rest`
                  : 'estimated from intervals'}
              </div>
            </div>
          </div>

          {/* Stroke Distribution */}
          {sortedStrokes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
                  <Waves size={13} className="text-white" />
                </div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Stroke Distribution</span>
              </div>
              <div className="space-y-2.5">
                {sortedStrokes.map(([stroke, { meters, percentage }]) => {
                  const colors = STROKE_COLORS[stroke] || DEFAULT_COLOR;
                  return (
                    <div key={stroke}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {STROKE_ICONS[stroke] ? (
                            <img src={STROKE_ICONS[stroke]} alt={stroke} className="w-14 h-8 brightness-0 invert" />
                          ) : (
                            <Waves size={14} className="text-slate-400" />
                          )}
                          <span className="text-sm text-slate-200">{STROKE_LABELS[stroke] || stroke}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">{meters}m</span>
                          <span className="font-medium text-slate-300">{percentage}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            background: colors.bg,
                            boxShadow: `0 0 8px ${colors.glow}`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Breakdown */}
          {sortedActivities.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Activity size={13} className="text-white" />
                </div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Activity Breakdown</span>
              </div>
              <div className="space-y-2.5">
                {sortedActivities.map(([activity, { meters, percentage }]) => {
                  const colors = ACTIVITY_COLORS[activity] || DEFAULT_COLOR;
                  return (
                    <div key={activity}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-200 capitalize">{activity}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">{meters}m</span>
                          <span className="font-medium text-slate-300">{percentage}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            background: colors.bg,
                            boxShadow: `0 0 8px ${colors.glow}`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Energy Zones */}
          {Object.keys(analysis.energy_zone_breakdown).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Zap size={13} className="text-white" />
                </div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Energy Zones</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(analysis.energy_zone_breakdown).map(([zone, { percentage }]) => (
                  <span
                    key={zone}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full border px-3 py-1.5 ${ZONE_COLORS[zone] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}
                  >
                    {ZONE_LABELS[zone] || zone}
                    <span className="opacity-80">{percentage}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
