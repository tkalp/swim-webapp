import { formatTime } from '../../../utils/timeUtils';
import { TrendingDown, TrendingUp, Minus, Clock, Target } from 'lucide-react';

type RecentTrend = {
  improving: boolean;
  declining: boolean;
  stable: boolean;
  delta: number;
  count: number;
  times: number[];
  avgChangePerAttempt: number;
  percentage: number;
};

type AttemptsStatsProps = {
  recentTrend: RecentTrend | null;
  best: number;
  totalAttempts: number;
  improvedPct: number;
};

export default function AttemptsStats({
  recentTrend,
  best,
  totalAttempts,
  improvedPct
}: AttemptsStatsProps) {
  const getTrendIcon = () => {
    if (!recentTrend) return <Minus size={20} />;
    if (recentTrend.improving) return <TrendingDown size={20} />;
    if (recentTrend.declining) return <TrendingUp size={20} />;
    return <Minus size={20} />;
  };

  const getTrendColor = () => {
    if (!recentTrend) return 'text-slate-400';
    if (recentTrend.improving) return 'text-emerald-500';
    if (recentTrend.declining) return 'text-rose-500';
    return 'text-slate-400';
  };

  const getTrendBg = () => {
    if (!recentTrend) return 'from-slate-500/20 to-slate-500/10';
    if (recentTrend.improving) return 'from-emerald-500/30 to-emerald-400/20';
    if (recentTrend.declining) return 'from-rose-500/30 to-rose-400/20';
    return 'from-slate-500/20 to-slate-500/10';
  };

  return (
    <section className="flex flex-col sm:flex-row gap-6 mb-8">
      {/* Recent Performance */}
      <div className="flex-1 bg-background-elevated border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-border-light hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getTrendBg()} flex items-center justify-center ${getTrendColor()}`}>
            {getTrendIcon()}
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Recent Trend</div>
        </div>
        {recentTrend ? (
          <>
            <div className={`text-xl font-bold mb-2 ${getTrendColor()}`}>
              {recentTrend.improving && `↓ ${Math.abs(recentTrend.delta).toFixed(2)}s faster`}
              {recentTrend.declining && `↑ ${Math.abs(recentTrend.delta).toFixed(2)}s slower`}
              {recentTrend.stable && 'Stable'}
            </div>
            <div className="text-sm text-text-muted font-medium">
              {!recentTrend.stable && (
                <span className={getTrendColor()}>
                  {recentTrend.percentage >= 0 ? '+' : ''}{recentTrend.percentage}%
                </span>
              )}
              {!recentTrend.stable && ' • '}
              Last {recentTrend.count} attempt{recentTrend.count !== 1 ? 's' : ''}
            </div>
          </>
        ) : (
          <>
            <div className="text-xl font-bold text-slate-400 mb-2">
              Not enough data
            </div>
            <div className="text-sm text-text-muted font-medium">
              Need 2+ attempts
            </div>
          </>
        )}
      </div>
      
      {/* Best Time */}
      <div className="flex-1 bg-background-elevated border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-border-light hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center text-amber-500">
            <Target size={20} />
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Best Time</div>
        </div>
        <div className="text-xl font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent mb-2">
          {formatTime(best)}
        </div>
        <div className="text-sm text-text-muted font-medium">
          Across {totalAttempts} attempt{totalAttempts !== 1 ? 's' : ''}
        </div>
      </div>
      
      {/* Improvement */}
      <div className="flex-1 bg-background-elevated border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-border-light hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
        <div className={`absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
          improvedPct >= 0 
            ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500' 
            : 'bg-gradient-to-r from-rose-500 via-red-500 to-pink-500'
        }`}></div>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            improvedPct >= 0 
              ? 'bg-gradient-to-br from-emerald-500/30 to-green-500/20 text-emerald-500' 
              : 'bg-gradient-to-br from-rose-500/30 to-red-500/20 text-rose-500'
          }`}>
            <Clock size={20} />
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Improvement</div>
        </div>
        <div 
          className={`text-xl font-bold mb-2 ${improvedPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
        >
          {improvedPct >= 0 ? '+' : ''}{improvedPct}%
        </div>
        <div className="text-sm text-text-muted font-medium">First vs Last</div>
      </div>
    </section>
  );
}