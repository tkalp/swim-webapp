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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* Total swimmers */}
      <div className="relative bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl border-2 border-cyan-500/30 p-6 shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text mb-2">
            {summary.total_swimmers}
          </div>
          <div className="text-sm font-semibold text-text-secondary">Total Swimmers</div>
        </div>
      </div>

      {/* Average improvement */}
      <div className={`relative bg-gradient-to-br ${
        isImproving 
          ? 'from-emerald-500/10 via-green-500/10 to-emerald-500/10 border-emerald-500/30 hover:shadow-emerald-500/20' 
          : 'from-red-500/10 via-orange-500/10 to-red-500/10 border-red-500/30 hover:shadow-red-500/20'
      } rounded-2xl border-2 p-6 shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-300`}>
        <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${
          isImproving ? 'from-emerald-500/20 to-green-500/20' : 'from-red-500/20 to-orange-500/20'
        } rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500`}></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-3 bg-gradient-to-br ${
              isImproving ? 'from-emerald-500 to-green-500 shadow-emerald-500/30' : 'from-red-500 to-orange-500 shadow-red-500/30'
            } rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <TrendingDown className={`w-6 h-6 text-white`} />
            </div>
          </div>
          <div className={`text-3xl font-bold text-transparent bg-gradient-to-r ${
            isImproving ? 'from-emerald-400 to-green-400' : 'from-red-400 to-orange-400'
          } bg-clip-text mb-2`}>
            {isImproving ? '-' : '+'}{avgImprovementAbs.toFixed(1)}%
          </div>
          <div className="text-sm font-semibold text-text-secondary">Avg Improvement</div>
        </div>
      </div>

      {/* Total PRs */}
      <div className="relative bg-gradient-to-br from-yellow-500/10 via-amber-500/10 to-yellow-500/10 rounded-2xl border-2 border-yellow-500/30 p-6 shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl shadow-lg shadow-yellow-500/30 group-hover:scale-110 transition-transform duration-300">
              <Trophy className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text mb-2">
            {summary.total_prs}
          </div>
          <div className="text-sm font-semibold text-text-secondary">Personal Records</div>
        </div>
      </div>

      {/* Most improved swimmer */}
      <div className="relative bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-purple-500/10 rounded-2xl border-2 border-purple-500/30 p-6 shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform duration-300">
              <Award className="w-6 h-6 text-white" />
            </div>
          </div>
          {summary.most_improved ? (
            <>
              <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text mb-2">
                -{Math.abs(summary.most_improved.improvement_pct).toFixed(1)}%
              </div>
              <div className="text-sm font-semibold text-text-secondary truncate" title={summary.most_improved.swimmer_name}>
                {summary.most_improved.swimmer_name}
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-text-tertiary mb-2">—</div>
              <div className="text-sm font-semibold text-text-secondary">No data</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
