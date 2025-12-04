import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useSquadPerformance } from '@/hooks/useSquadPerformance';
import { SquadSummaryStats } from '@/components/squad-analytics/SquadSummaryStats';
import { SquadPageHeader } from '../SquadPageHeader';
import { PerformanceHeader } from '@/components/squad/performance/PerformanceHeader';
import { PerformanceTable } from '@/components/squad/performance/PerformanceTable';
import { getDefaultDateRange } from '@/components/squad/performance/utils';

interface SquadPerformanceTabProps {
  squadId: string;
}

const SquadPerformanceTab: React.FC<SquadPerformanceTabProps> = ({ squadId }) => {
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [expandedSwimmerId, setExpandedSwimmerId] = useState<string | null>(null);

  // Use cached query for performance data
  const { 
    data, 
    isLoading: loading, 
    error: queryError,
    refetch 
  } = useSquadPerformance(squadId, dateRange.start, dateRange.end);

  const error = queryError ? String(queryError) : null;

  const handleDateChange = useCallback((field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleSwimmerExpanded = useCallback((swimmerId: string) => {
    setExpandedSwimmerId(prev => prev === swimmerId ? null : swimmerId);
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
          <h1 className="text-3xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">Performance Tracking</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Track swimmer progress and personal bests across all events</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-slate-800/40 shadow-lg">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Period:</span>
          <PerformanceHeader
            startDate={dateRange.start}
            endDate={dateRange.end}
            onDateChange={handleDateChange}
          />
        </div>
      </div>
      
      <div className="space-y-6">
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

