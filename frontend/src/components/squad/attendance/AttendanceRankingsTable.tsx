import React from 'react';
import { SwimmerAttendance } from '@/services/attendanceService';

interface AttendanceRankingsTableProps {
  swimmers: SwimmerAttendance[];
}

export const AttendanceRankingsTable: React.FC<AttendanceRankingsTableProps> = ({ swimmers }) => {
  // Sort by present percentage descending
  const sortedSwimmers = [...swimmers].sort((a, b) => b.present_percentage - a.present_percentage);

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 95) return 'text-emerald-400';
    if (percentage >= 85) return 'text-green-400';
    if (percentage >= 75) return 'text-yellow-400';
    if (percentage >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 95) return 'from-emerald-500 to-green-400';
    if (percentage >= 85) return 'from-green-500 to-emerald-400';
    if (percentage >= 75) return 'from-yellow-500 to-amber-400';
    if (percentage >= 60) return 'from-orange-500 to-yellow-400';
    return 'from-red-500 to-orange-400';
  };

  const getRankAvatarStyle = (index: number) => {
    const rank = index + 1;
    if (rank <= 3) {
      // Top 3 get special gradient backgrounds
      const gradients = [
        'bg-linear-to-br from-yellow-500 to-amber-600', // 1st - gold
        'bg-linear-to-br from-gray-300 to-gray-500',     // 2nd - silver
        'bg-linear-to-br from-orange-500 to-amber-700',  // 3rd - bronze
      ];
      return {
        containerClass: `flex items-center justify-center w-12 h-12 rounded-full ${gradients[index]} shadow-lg`,
        textClass: 'text-white font-bold text-lg',
      };
    }
    return {
      containerClass: 'flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/80 border-2 border-slate-800/60',
      textClass: 'text-slate-100 font-semibold text-base',
    };
  };

  if (sortedSwimmers.length === 0) {
    return (
      <div className="relative bg-linear-to-br from-slate-900/90 via-slate-800/20 to-slate-900/90 rounded-2xl border-2 border-slate-800/40 overflow-hidden shadow-xl">
        <div className="p-6 border-b-2 border-slate-800/40 bg-linear-to-r from-slate-800/50 to-slate-800/30">
          <h3 className="text-xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">Attendance Rankings</h3>
          <p className="text-sm text-slate-400 mt-1 font-medium">Ranked by attendance rate</p>
        </div>
        <div className="p-12 text-center">
          <p className="text-slate-400 font-medium">No attendance data available for the selected period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-linear-to-br from-slate-900/90 via-slate-800/20 to-slate-900/90 rounded-2xl border-2 border-slate-800/40 overflow-hidden shadow-2xl">
      {/* Animated glow */}
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-linear-to-br from-emerald-500/10 via-green-500/10 to-emerald-500/10 rounded-full blur-3xl"></div>
      
      <div className="relative">
        <div className="p-6 border-b-2 border-slate-800/40 bg-linear-to-r from-slate-800/50 to-slate-800/30">
          <h3 className="text-xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">Attendance Rankings</h3>
          <p className="text-sm text-slate-400 mt-1 font-medium">Ranked by attendance rate</p>
        </div>

        <div className="divide-y divide-border/30">
          {sortedSwimmers.map((swimmer, index) => (
            <div
              key={swimmer.swimmer_id}
              className="px-6 py-4 hover:bg-slate-800/20 transition-colors duration-200"
            >
              <div className="flex items-center gap-4">
                {/* Rank Avatar */}
                <div className="shrink-0">
                  <div className={getRankAvatarStyle(index).containerClass}>
                    <span className={getRankAvatarStyle(index).textClass}>
                      {index + 1}
                    </span>
                  </div>
                </div>

                {/* Swimmer Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <h4 className="text-base font-semibold text-slate-100 truncate">
                      {swimmer.swimmer_name}
                    </h4>
                    <span className={`text-xl font-bold shrink-0 ${getPercentageColor(swimmer.present_percentage)}`}>
                      {swimmer.present_percentage.toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Compact Progress Bar */}
                  <div className="mt-2">
                    <div className="h-2 bg-slate-800/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-linear-to-r ${getProgressBarColor(swimmer.present_percentage)} rounded-full transition-all duration-700`}
                        style={{ width: `${swimmer.present_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Minimal Stats */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="font-medium">{swimmer.present} / {swimmer.total_sessions} present</span>
                    {swimmer.late > 0 && <span>{swimmer.late} late</span>}
                    {swimmer.absent > 0 && <span>{swimmer.absent} absent</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


