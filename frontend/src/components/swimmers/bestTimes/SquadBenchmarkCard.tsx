import { useMemo } from 'react';
import { Users, TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';
import { formatTime } from '@/utils/timeUtils';

interface SquadMateResult {
  swimmer_id: string;
  time_seconds: number;
  performed_on: string;
}

interface SquadBenchmarkCardProps {
  event: string;
  swimmerBestTime: number;
  swimmerBestTimeDisplay: string;
  swimmerId: string;
  squadMates: SquadMateResult[];
  showInactive?: boolean;
}

export default function SquadBenchmarkCard({
  event,
  swimmerBestTime,
  swimmerBestTimeDisplay,
  swimmerId,
  squadMates,
  showInactive = false
}: SquadBenchmarkCardProps) {
  
  const benchmarkData = useMemo(() => {
    // Filter out current swimmer
    const otherSwimmers = squadMates.filter(s => s.swimmer_id !== swimmerId);
    
    if (otherSwimmers.length === 0) {
      return null;
    }

    // Sort by best time (fastest first)
    const sortedSwimmers = [...otherSwimmers, {
      swimmer_id: swimmerId,
      time_seconds: swimmerBestTime,
      performed_on: ''
    }].sort((a, b) => a.time_seconds - b.time_seconds);

    // Calculate rank
    const rank = sortedSwimmers.findIndex(s => s.swimmer_id === swimmerId) + 1;
    const totalSwimmers = sortedSwimmers.length;
    const percentile = Math.round((1 - (rank - 1) / (totalSwimmers - 1)) * 100);

    // Calculate gaps
    const leaderTime = sortedSwimmers[0].time_seconds;
    const gapToLeader = swimmerBestTime - leaderTime;
    
    // Calculate median
    const times = sortedSwimmers.map(s => s.time_seconds);
    const sortedTimes = [...times].sort((a, b) => a - b);
    const medianTime = sortedTimes.length % 2 === 0
      ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
      : sortedTimes[Math.floor(sortedTimes.length / 2)];
    const gapToMedian = swimmerBestTime - medianTime;

    return {
      rank,
      totalSwimmers,
      percentile,
      gapToLeader,
      gapToMedian,
      leaderTime,
      leaderName: 'Squad Leader',
      medianTime,
      isLeader: rank === 1,
      sortedSwimmers
    };
  }, [squadMates, swimmerId, swimmerBestTime, swimmerBestTimeDisplay]);

  if (!benchmarkData || benchmarkData.totalSwimmers < 3) {
    return (
      <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/40">
        <div className="flex items-center gap-2 mb-2">
          <Users size={16} className="text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-300">Squad Comparison</h4>
        </div>
        <p className="text-xs text-slate-500">
          {benchmarkData ? 'Not enough squad data for comparison (minimum 3 swimmers)' : 'No squad data available'}
        </p>
      </div>
    );
  }

  const { rank, totalSwimmers, percentile, gapToLeader, gapToMedian, isLeader, sortedSwimmers } = benchmarkData;

  // Determine percentile badge color
  const getPercentileBadge = () => {
    if (percentile >= 80) return { color: 'text-purple-400 bg-purple-500/20', label: `Top ${100 - percentile + 1}%` };
    if (percentile >= 60) return { color: 'text-cyan-400 bg-cyan-500/20', label: `Top ${100 - percentile + 1}%` };
    if (percentile >= 40) return { color: 'text-blue-400 bg-blue-500/20', label: 'Middle' };
    return { color: 'text-slate-400 bg-slate-500/20', label: `Bottom ${percentile}%` };
  };

  const badge = getPercentileBadge();

  const formatGap = (gap: number) => {
    if (Math.abs(gap) < 0.01) return '±0.00s';
    return gap > 0 ? `+${gap.toFixed(2)}s` : `${gap.toFixed(2)}s`;
  };

  return (
    <div className="bg-linear-to-br from-slate-800/60 to-slate-800/30 rounded-lg p-4 border border-slate-700/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-cyan-400" />
          <h4 className="text-sm font-semibold text-slate-100">Squad Comparison</h4>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>
          {badge.label}
        </div>
      </div>

      {/* Rank Info */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded p-3 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">Squad Rank</div>
          <div className="flex items-baseline gap-1">
            {isLeader && <Award size={14} className="text-yellow-400 mb-0.5" />}
            <span className="text-lg font-bold text-slate-100">#{rank}</span>
            <span className="text-xs text-slate-500">of {totalSwimmers}</span>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded p-3 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">Percentile</div>
          <div className="text-lg font-bold text-cyan-400">{percentile}%</div>
        </div>
      </div>

      {/* Gap Stats */}
      <div className="space-y-2 mb-4">
        {!isLeader && (
          <div className="flex items-center justify-between text-xs bg-slate-900/30 rounded p-2">
            <span className="text-slate-400">Gap to leader:</span>
            <div className="flex items-center gap-1">
              <span className={gapToLeader > 0 ? 'text-yellow-400' : 'text-green-400'}>
                {formatGap(gapToLeader)}
              </span>
              {gapToLeader > 0 ? <TrendingDown size={12} className="text-yellow-400" /> : <TrendingUp size={12} className="text-green-400" />}
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs bg-slate-900/30 rounded p-2">
          <span className="text-slate-400">Gap to median:</span>
          <div className="flex items-center gap-1">
            <span className={gapToMedian > 0 ? 'text-yellow-400' : gapToMedian < 0 ? 'text-green-400' : 'text-slate-400'}>
              {formatGap(gapToMedian)}
            </span>
            {gapToMedian > 0 ? (
              <TrendingDown size={12} className="text-yellow-400" />
            ) : gapToMedian < 0 ? (
              <TrendingUp size={12} className="text-green-400" />
            ) : (
              <Minus size={12} className="text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Visual Position Bar */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400 mb-2">Position in Squad</div>
        <div className="relative h-8 bg-slate-900/50 rounded-lg border border-slate-700/30 overflow-hidden">
          {/* Position markers */}
          <div className="absolute inset-0 flex items-center">
            {sortedSwimmers.map((swimmer, idx) => {
              const position = (idx / (totalSwimmers - 1)) * 100;
              const isCurrentSwimmer = swimmer.swimmer_id === swimmerId;
              
              return (
                <div
                  key={swimmer.swimmer_id}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                >
                  <div
                    className={`w-2 h-2 rounded-full transition-all ${
                      isCurrentSwimmer 
                        ? 'bg-cyan-400 ring-2 ring-cyan-400/30 scale-150' 
                        : 'bg-slate-600'
                    }`}
                    title={`Swimmer ${idx + 1}: ${formatTime(swimmer.time_seconds)}`}
                  />
                </div>
              );
            })}
          </div>
          
          {/* Gradient background */}
          <div className="absolute inset-0 bg-linear-to-r from-purple-500/20 via-cyan-500/20 to-slate-500/20" />
        </div>
        
        {/* Labels */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Award size={10} className="text-purple-400" />
            Fastest
          </span>
          <span>Slowest</span>
        </div>
      </div>
    </div>
  );
}
