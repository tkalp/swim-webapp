import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { 
  getSquadPerformance, 
  SquadPerformanceData,
} from '../../../features/squads/metricsApi';
import { SquadSummaryStats } from '../../squad-analytics/SquadSummaryStats';
import { PerformanceHeader } from './PerformanceHeader';
import { PerformanceTable } from './PerformanceTable';
import { getDefaultDateRange } from './utils';

interface SquadPerformanceTabProps {
  squadId: string;
}

const SquadPerformanceTab: React.FC<SquadPerformanceTabProps> = ({ squadId }) => {
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [data, setData] = useState<SquadPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSwimmerId, setExpandedSwimmerId] = useState<string | null>(null);

  // Fetch performance data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getSquadPerformance(
          squadId,
          dateRange.start,
          dateRange.end
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [squadId, dateRange]);

  const handleDateChange = useCallback((field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleSwimmerExpanded = useCallback((swimmerId: string) => {
    setExpandedSwimmerId(prev => prev === swimmerId ? null : swimmerId);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <PerformanceHeader
          startDate={dateRange.start}
          endDate={dateRange.end}
          onDateChange={handleDateChange}
        />

        <SquadSummaryStats summary={data.summary} />

        <PerformanceTable
          swimmers={data.swimmers}
          expandedSwimmerId={expandedSwimmerId}
          onToggleExpanded={toggleSwimmerExpanded}
        />
      </div>
    </div>
  );
};

export default SquadPerformanceTab;
