import React from 'react';
import { SwimmerPerformance } from '@/services/metricsService';
import { SwimmerRow } from '@/components/squad/performance/SwimmerRow';

interface PerformanceTableProps {
  swimmers: SwimmerPerformance[];
  expandedSwimmerId: string | null;
  onToggleExpanded: (swimmerId: string) => void;
}

export const PerformanceTable: React.FC<PerformanceTableProps> = ({
  swimmers,
  expandedSwimmerId,
  onToggleExpanded,
}) => {
  if (swimmers.length === 0) {
    return (
      <div className="relative bg-linear-to-br from-slate-900/90 via-slate-800/20 to-slate-900/90 rounded-2xl border-2 border-slate-800/40 overflow-hidden shadow-xl">
        <div className="p-6 border-b-2 border-slate-800/40 bg-linear-to-r from-slate-800/50 to-slate-800/30">
          <h3 className="text-xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">Swimmer Performance Breakdown</h3>
          <p className="text-sm text-slate-400 mt-1 font-medium">Click on a swimmer to view event details</p>
        </div>
        <div className="p-12 text-center">
          <p className="text-slate-400 font-medium">
            No performance data available for the selected date range.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Try adjusting the date range or ensure swimmers have logged workouts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-linear-to-br from-slate-900/90 via-slate-800/20 to-slate-900/90 rounded-2xl border-2 border-slate-800/40 overflow-hidden shadow-2xl">
      {/* Animated glow */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-linear-to-br from-purple-500/10 via-pink-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
      
      <div className="relative">
        <div className="p-6 border-b-2 border-slate-800/40 bg-linear-to-r from-slate-800/50 to-slate-800/30">
          <h3 className="text-xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">Swimmer Performance Breakdown</h3>
          <p className="text-sm text-slate-400 mt-1 font-medium">Click on a swimmer to view event details</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-linear-to-r from-slate-800/40 to-slate-800/20">
              <tr className="text-left text-xs font-bold text-transparent bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text uppercase tracking-wider">
                <th className="px-6 py-4">Swimmer</th>
                <th className="px-6 py-4 text-center">Events</th>
                <th className="px-6 py-4 text-center">PRs</th>
                <th className="px-6 py-4 text-center">Avg Improvement</th>
                <th className="px-6 py-4 text-center">Best Improvement</th>
                <th className="px-6 py-4 text-center">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {swimmers.map((swimmer) => (
                <SwimmerRow
                  key={swimmer.swimmer_id}
                  swimmer={swimmer}
                  isExpanded={expandedSwimmerId === swimmer.swimmer_id}
                  onToggle={() => onToggleExpanded(swimmer.swimmer_id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

