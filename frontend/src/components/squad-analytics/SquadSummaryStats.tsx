import React from 'react';
import { SquadSummary } from '@/services/metricsService';
import { TrendingDown, Award, Activity, TrendingUp } from 'lucide-react';

interface SquadSummaryStatsProps {
  summary: SquadSummary;
}

export const SquadSummaryStats: React.FC<SquadSummaryStatsProps> = ({ summary }) => {
  const medianImprovement = summary.median_weighted_improvement || 0;
  const medianIsImproving = medianImprovement < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Median Weighted Improvement */}
      <div className={`relative backdrop-blur-sm rounded-2xl border p-5 hover:shadow-lg transition-all duration-300 group overflow-hidden ${
        medianIsImproving 
          ? 'bg-linear-to-br from-emerald-500/10 via-teal-500/10 to-transparent border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-emerald-500/20' 
          : 'bg-linear-to-br from-orange-500/10 via-red-500/10 to-transparent border-orange-500/30 hover:border-orange-400/60 hover:shadow-orange-500/20'
      }`}>
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500 ${
          medianIsImproving ? 'bg-linear-to-br from-emerald-400/20 to-teal-400/20' : 'bg-linear-to-br from-orange-400/20 to-red-400/20'
        }`}></div>
        <div className="relative flex items-center gap-3">
          <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg ${
            medianIsImproving 
              ? 'bg-linear-to-br from-emerald-500/30 to-teal-500/30 shadow-emerald-500/20' 
              : 'bg-linear-to-br from-orange-500/30 to-red-500/30 shadow-orange-500/20'
          }`}>
            {medianIsImproving ? (
              <TrendingDown className="w-6 h-6 text-emerald-300" />
            ) : (
              <TrendingUp className="w-6 h-6 text-orange-300" />
            )}
          </div>
          <div>
            <div className={`text-3xl font-bold text-transparent bg-clip-text ${
              medianIsImproving ? 'bg-linear-to-br from-emerald-300 to-teal-300' : 'bg-linear-to-br from-orange-300 to-red-300'
            }`}>
              {medianIsImproving ? '-' : '+'}{Math.abs(medianImprovement).toFixed(1)}%
            </div>
            <div className={`text-xs font-semibold ${
              medianIsImproving ? 'text-emerald-300/70' : 'text-orange-300/70'
            }`}>
              Median Improvement
            </div>
          </div>
        </div>
      </div>

      {/* Most Improved */}
      <div className="relative bg-linear-to-br from-purple-500/10 via-pink-500/10 to-transparent backdrop-blur-sm rounded-2xl border border-purple-500/30 p-5 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 group overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-linear-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative flex items-center gap-3">
          <div className="p-3 bg-linear-to-br from-purple-500/30 to-pink-500/30 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-purple-500/20">
            <Award className="w-6 h-6 text-purple-300" />
          </div>
          <div className="flex-1 min-w-0">
            {summary.most_improved ? (
              <>
                <div className="text-2xl font-bold text-transparent bg-linear-to-br from-emerald-300 to-teal-300 bg-clip-text">
                  -{Math.abs(summary.most_improved.improvement_pct).toFixed(1)}%
                </div>
                <div className="text-xs font-semibold text-purple-300/70 truncate">
                  {summary.most_improved.swimmer_name}
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold text-slate-500">—</div>
                <div className="text-xs font-medium text-slate-400">No data</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Avg Consistency */}
      {summary.avg_consistency_score !== undefined && (
        <div className="relative bg-linear-to-br from-blue-500/10 via-indigo-500/10 to-transparent backdrop-blur-sm rounded-2xl border border-blue-500/30 p-5 hover:border-blue-400/60 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 group overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-linear-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative flex items-center gap-3">
            <div className="p-3 bg-linear-to-br from-blue-500/30 to-indigo-500/30 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20">
              <Activity className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-transparent bg-linear-to-br from-blue-300 to-indigo-300 bg-clip-text">
                {Math.round(summary.avg_consistency_score)}%
              </div>
              <div className="text-xs font-semibold text-blue-300/70">
                Avg Consistency
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};