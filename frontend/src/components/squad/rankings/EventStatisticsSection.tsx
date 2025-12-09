import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BarChart3, Users, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { getSquadEventStatistics, type EventStatistics } from '@/services/squadService';
import { formatTime } from '@/services/workoutResultService';

interface EventStatisticsSectionProps {
  squadId: string;
  distance: number | null;
  stroke: string;
  activity: string;
  resultUnits: string;
}

export default function EventStatisticsSection({
  squadId,
  distance,
  stroke,
  activity,
  resultUnits
}: EventStatisticsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isExpanded || !distance) {
      return;
    }

    const fetchStatistics = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSquadEventStatistics(squadId, distance, stroke, activity, resultUnits);
        setStatistics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
        setStatistics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [squadId, distance, stroke, activity, resultUnits, isExpanded]);

  if (!distance) {
    return null;
  }

  const hasData = statistics && statistics.sample_size >= 3;

  return (
    <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <BarChart3 size={20} className="text-cyan-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-slate-100">Event Statistics</h3>
            <p className="text-sm text-slate-400">
              Squad-wide performance metrics for this event
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp size={20} className="text-slate-400" />
        ) : (
          <ChevronDown size={20} className="text-slate-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-700/30">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && !hasData && (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-6 text-center">
              <p className="text-slate-400 text-sm">
                {statistics?.sample_size === 0
                  ? 'No results found for this event'
                  : 'Not enough data (minimum 3 results required)'}
              </p>
              {statistics && statistics.sample_size > 0 && statistics.sample_size < 3 && (
                <p className="text-slate-500 text-xs mt-2">
                  {statistics.sample_size} result{statistics.sample_size !== 1 ? 's' : ''} found
                </p>
              )}
            </div>
          )}

          {!loading && !error && hasData && statistics && (
            <div className="space-y-4">
              {/* Sample Size Badge */}
              <div className="flex items-center gap-2 text-sm">
                <Users size={16} className="text-slate-400" />
                <span className="text-slate-300">
                  <span className="font-semibold text-cyan-400">{statistics.sample_size}</span>{' '}
                  {statistics.sample_size === 1 ? 'result' : 'results'} analyzed
                </span>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Top 25% (Fastest) */}
                <StatCard
                  label="Top 25%"
                  value={statistics.top_quartile_time}
                  icon={<TrendingDown size={18} className="text-green-400" />}
                  iconBg="bg-green-500/10"
                  description="Fastest quarter"
                />

                {/* Median */}
                <StatCard
                  label="Median"
                  value={statistics.median_time}
                  icon={<Minus size={18} className="text-blue-400" />}
                  iconBg="bg-blue-500/10"
                  description="Middle value"
                />

                {/* Average */}
                <StatCard
                  label="Average"
                  value={statistics.avg_time}
                  icon={<BarChart3 size={18} className="text-cyan-400" />}
                  iconBg="bg-cyan-500/10"
                  description="Mean time"
                />

                {/* Bottom 25% (Slowest) */}
                <StatCard
                  label="Bottom 25%"
                  value={statistics.bottom_quartile_time}
                  icon={<TrendingUp size={18} className="text-orange-400" />}
                  iconBg="bg-orange-500/10"
                  description="Slowest quarter"
                />
              </div>

              {/* Info Text */}
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">How to read:</span> Top 25% represents
                  the fastest swimmers, while Bottom 25% represents those with room for improvement.
                  The median is the middle value when all times are sorted.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  iconBg: string;
  description: string;
}

function StatCard({ label, value, icon, iconBg, description }: StatCardProps) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 ${iconBg} rounded-lg`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-100 mt-2">
        {value !== null ? formatTime(value) : '-'}
      </p>
    </div>
  );
}
