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
      containerClass: 'flex items-center justify-center w-12 h-12 rounded-full bg-background-secondary/80 border-2 border-border/60',
      textClass: 'text-text-primary font-semibold text-base',
    };
  };

  if (sortedSwimmers.length === 0) {
    return (
      <div className="bg-background-elevated border border-border rounded-lg overflow-hidden shadow-md">
        <div className="p-6 border-b border-border">
          <h3 className="text-xl font-semibold text-text-primary">Attendance Rankings</h3>
          <p className="text-sm text-text-secondary mt-1">Ranked by attendance rate</p>
        </div>
        <div className="p-8 text-center">
          <p className="text-text-secondary">No attendance data available for the selected period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-elevated border border-border rounded-lg overflow-hidden shadow-md">
      <div className="p-6 border-b border-border">
        <h3 className="text-xl font-semibold text-text-primary">Attendance Rankings</h3>
        <p className="text-sm text-text-secondary mt-1">Ranked by attendance rate</p>
      </div>

      <div className="divide-y divide-border/40">
        {sortedSwimmers.map((swimmer, index) => (
          <div
            key={swimmer.swimmer_id}
            className="px-6 py-4 hover:bg-background-secondary/30 transition-colors duration-150"
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

              {/* Swimmer Info & Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="text-lg font-bold text-text-primary truncate">
                    {swimmer.swimmer_name}
                  </h4>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm text-text-muted">
                      {swimmer.total_sessions} sessions
                    </span>
                    <span className={`text-2xl font-bold ${getPercentageColor(swimmer.present_percentage)}`}>
                      {swimmer.present_percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Attendance Progress Bar */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-text-muted mb-1.5">
                      <span>Attendance Rate</span>
                      <span>{swimmer.present} / {swimmer.total_sessions} present</span>
                    </div>
                    <div className="h-2.5 bg-background-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-linear-to-r ${getProgressBarColor(swimmer.present_percentage)} rounded-full transition-all duration-500`}
                        style={{ width: `${swimmer.present_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Breakdown Stats */}
                  <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-text-muted">Present:</span>
                      <span className="font-semibold text-text-primary">
                        {swimmer.present} <span className="text-text-muted">({swimmer.present_percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    {swimmer.late > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <span className="text-text-muted">Late:</span>
                        <span className="font-semibold text-text-primary">
                          {swimmer.late} <span className="text-text-muted">({swimmer.late_percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                    )}
                    {swimmer.absent > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <span className="text-text-muted">Absent:</span>
                        <span className="font-semibold text-text-primary">
                          {swimmer.absent} <span className="text-text-muted">({swimmer.absent_percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
