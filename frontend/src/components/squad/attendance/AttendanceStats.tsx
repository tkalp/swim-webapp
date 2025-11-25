import React from 'react';
import { CheckCircle, Clock, XCircle, Calendar } from 'lucide-react';
import { AttendanceStats as AttendanceStatsType } from '@/services/attendanceService';

interface AttendanceStatsProps {
  stats: AttendanceStatsType;
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* Total Swimmers */}
      <div className="relative bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl border-2 border-cyan-500/30 p-6 shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform duration-300">
              <Calendar className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text mb-2">
            {stats.total_swimmers}
          </div>
          <div className="text-sm font-semibold text-text-secondary">Total Swimmers</div>
        </div>
      </div>

      {/* Present Rate */}
      <div className="relative bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-emerald-500/10 rounded-2xl border-2 border-emerald-500/30 p-6 shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text mb-2">
            {stats.avg_present_percentage.toFixed(1)}%
          </div>
          <div className="text-sm font-semibold text-text-secondary">Avg Attendance</div>
        </div>
      </div>

      {/* Late Rate */}
      <div className="relative bg-gradient-to-br from-yellow-500/10 via-amber-500/10 to-yellow-500/10 rounded-2xl border-2 border-yellow-500/30 p-6 shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl shadow-lg shadow-yellow-500/30 group-hover:scale-110 transition-transform duration-300">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text mb-2">
            {stats.avg_late_percentage.toFixed(1)}%
          </div>
          <div className="text-sm font-semibold text-text-secondary">Avg Late</div>
        </div>
      </div>

      {/* Absent Rate */}
      <div className="relative bg-gradient-to-br from-red-500/10 via-orange-500/10 to-red-500/10 rounded-2xl border-2 border-red-500/30 p-6 shadow-xl overflow-hidden group hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-300">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform duration-300">
              <XCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text mb-2">
            {stats.avg_absent_percentage.toFixed(1)}%
          </div>
          <div className="text-sm font-semibold text-text-secondary">Avg Absent</div>
        </div>
      </div>
    </div>
  );
};
