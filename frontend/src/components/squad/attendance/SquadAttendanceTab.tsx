import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { 
  getSquadAttendanceRankings, 
  SquadAttendanceData,
} from '@/services/attendanceService';
import { SquadPageHeader } from '../SquadPageHeader';
import { AttendanceHeader } from '@/components/squad/attendance/AttendanceHeader';
import { AttendanceStats } from '@/components/squad/attendance/AttendanceStats';
import { AttendanceRankingsTable } from '@/components/squad/attendance/AttendanceRankingsTable';
import { getDefaultDateRange } from '../performance/utils';

// Helper function to check if attendance data exists
export function hasAttendanceData(data: SquadAttendanceData | null): boolean {
  if (!data) return false;
  
  // Check if there are any swimmers with attendance records
  const hasSwimmers = data.swimmers && data.swimmers.length > 0;
  
  // Check if there are any sessions
  const hasSessions = data.stats && data.stats.total_sessions > 0;
  
  return !!(hasSwimmers || hasSessions);
}

interface SquadAttendanceTabProps {
  squadId: string;
}

const SquadAttendanceTab: React.FC<SquadAttendanceTabProps> = ({ squadId }) => {
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [data, setData] = useState<SquadAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch attendance data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getSquadAttendanceRankings(
          squadId,
          dateRange.start,
          dateRange.end
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [squadId, dateRange]);

  const handleDateChange = useCallback((field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-linear-to-r from-emerald-400 to-green-400 bg-clip-text">Attendance Metrics</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Track attendance rates and commitment across the squad</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-slate-800/40 shadow-lg">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Period:</span>
          <AttendanceHeader
            startDate={dateRange.start}
            endDate={dateRange.end}
            onDateChange={handleDateChange}
          />
        </div>
      </div>
      
      <div className="space-y-6">
        <AttendanceStats stats={data.stats} />

        <AttendanceRankingsTable swimmers={data.swimmers} />
      </div>
    </div>
  );
};

export default SquadAttendanceTab;

