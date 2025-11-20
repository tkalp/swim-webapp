import React from 'react';
import { SquadSummary } from '@/services/metricsService';
import { Users, TrendingDown, Trophy, Award } from 'lucide-react';

interface SquadSummaryStatsProps {
  summary: SquadSummary;
}

export const SquadSummaryStats: React.FC<SquadSummaryStatsProps> = ({ summary }) => {
  const avgImprovementAbs = Math.abs(summary.avg_improvement);
  const isImproving = summary.avg_improvement < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total swimmers */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-white mb-1">
          {summary.total_swimmers}
        </div>
        <div className="text-sm text-gray-400">Total Swimmers</div>
      </div>

      {/* Average improvement */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${
            isImproving ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <TrendingDown className={`w-5 h-5 ${
              isImproving ? 'text-green-400' : 'text-red-400'
            }`} />
          </div>
        </div>
        <div className={`text-2xl font-bold mb-1 ${
          isImproving ? 'text-green-400' : 'text-red-400'
        }`}>
          {isImproving ? '-' : '+'}{avgImprovementAbs.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-400">Avg Improvement</div>
      </div>

      {/* Total PRs */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-white mb-1">
          {summary.total_prs}
        </div>
        <div className="text-sm text-gray-400">Personal Records</div>
      </div>

      {/* Most improved swimmer */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Award className="w-5 h-5 text-purple-400" />
          </div>
        </div>
        {summary.most_improved ? (
          <>
            <div className="text-2xl font-bold text-green-400 mb-1">
              -{Math.abs(summary.most_improved.improvement_pct).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400 truncate" title={summary.most_improved.swimmer_name}>
              {summary.most_improved.swimmer_name}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold text-gray-500 mb-1">—</div>
            <div className="text-sm text-gray-400">No data</div>
          </>
        )}
      </div>
    </div>
  );
};
