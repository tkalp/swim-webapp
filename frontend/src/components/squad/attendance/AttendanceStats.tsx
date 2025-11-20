import React from 'react';
import { CheckCircle, Clock, XCircle, Calendar } from 'lucide-react';
import { AttendanceStats as AttendanceStatsType } from '../../../services/attendanceService';

interface AttendanceStatsProps {
  stats: AttendanceStatsType;
}

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Swimmers */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Calendar className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-white mb-1">
          {stats.total_swimmers}
        </div>
        <div className="text-sm text-gray-400">Total Swimmers</div>
      </div>

      {/* Present Rate */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-green-400 mb-1">
          {stats.avg_present_percentage.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-400">Avg Attendance</div>
      </div>

      {/* Late Rate */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-yellow-400 mb-1">
          {stats.avg_late_percentage.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-400">Avg Late</div>
      </div>

      {/* Absent Rate */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-red-400 mb-1">
          {stats.avg_absent_percentage.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-400">Avg Absent</div>
      </div>
    </div>
  );
};
