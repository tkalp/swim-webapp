import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { 
  getSquadAttendanceRankings, 
  SquadAttendanceData,
} from '../../../services/attendanceService';
import { SquadPageHeader } from '../SquadPageHeader';
import { AttendanceHeader } from './AttendanceHeader';
import { AttendanceStats } from './AttendanceStats';
import { AttendanceRankingsTable } from './AttendanceRankingsTable';
import { getDefaultDateRange } from '../performance/utils';

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
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
      <SquadPageHeader
        title="Attendance Metrics"
        subtitle="Track attendance rates and commitment across the squad"
      />
      
      <div className="space-y-6">
        <AttendanceHeader
          startDate={dateRange.start}
          endDate={dateRange.end}
          onDateChange={handleDateChange}
        />

        <AttendanceStats stats={data.stats} />

        <AttendanceRankingsTable swimmers={data.swimmers} />
      </div>
    </div>
  );
};

export default SquadAttendanceTab;
