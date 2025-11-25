import { formatTime } from '@/utils/timeUtils';
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
      <div className="flex-1 bg-linear-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500"></div>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${getTrendBg()} flex items-center justify-center ${getTrendColor()} border border-current/30 shadow-lg`}>
            {getTrendIcon()}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Recent Trend</div>
        </div>
        {recentTrend ? (
          <>
            <div className={`text-xl font-bold mb-2 ${getTrendColor()}`}>
              {recentTrend.improving && `↓ ${Math.abs(recentTrend.delta).toFixed(2)}s faster`}
              {recentTrend.declining && `↑ ${Math.abs(recentTrend.delta).toFixed(2)}s slower`}
              {recentTrend.stable && 'Stable'}
            </div>
            <div className="text-sm text-slate-400 font-medium">
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
            <div className="text-sm text-slate-400 font-medium">
              Need 2+ attempts
            </div>
          </>
        )}
      </div>
      
      {/* Best Time */}
      <div className="flex-1 bg-linear-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500"></div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-yellow-500/30 to-amber-500/30 flex items-center justify-center text-yellow-400 border border-yellow-500/40 shadow-lg shadow-yellow-500/20">
            <Target size={20} />
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Best Time</div>
        </div>
        <div className="text-xl font-bold bg-linear-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent mb-2">
          {formatTime(best)}
        </div>
        <div className="text-sm text-slate-400 font-medium">
          Across {totalAttempts} attempt{totalAttempts !== 1 ? 's' : ''}
        </div>
      </div>
      
      {/* Improvement */}
      <div className="flex-1 bg-linear-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500"></div>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-lg ${
            improvedPct >= 0 
              ? 'bg-linear-to-br from-emerald-500/30 to-green-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/20' 
              : 'bg-linear-to-br from-rose-500/30 to-red-500/20 text-rose-400 border-rose-500/40 shadow-rose-500/20'
          }`}>
            <Clock size={20} />
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Improvement</div>
        </div>
        <div 
          className={`text-xl font-bold mb-2 ${improvedPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {improvedPct >= 0 ? '+' : ''}{improvedPct}%
        </div>
        <div className="text-sm text-slate-400 font-medium">First vs Last</div>
      </div>
    </section>
  );
}