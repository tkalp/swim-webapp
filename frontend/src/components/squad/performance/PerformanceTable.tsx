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
      <div className="bg-background-elevated border border-border rounded-lg overflow-hidden shadow-md">
        <div className="p-6 border-b border-border">
          <h3 className="text-xl font-semibold text-text-primary">Swimmer Performance Breakdown</h3>
          <p className="text-sm text-text-secondary mt-1">Click on a swimmer to view event details</p>
        </div>
        <div className="p-8 text-center">
          <p className="text-text-secondary">
            No performance data available for the selected date range.
          </p>
          <p className="text-text-muted text-sm mt-2">
            Try adjusting the date range or ensure swimmers have logged workouts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-elevated border border-border rounded-lg overflow-hidden shadow-md">
      <div className="p-6 border-b border-border">
        <h3 className="text-xl font-semibold text-text-primary">Swimmer Performance Breakdown</h3>
        <p className="text-sm text-text-secondary mt-1">Click on a swimmer to view event details</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background">
            <tr className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
              <th className="px-6 py-3">Swimmer</th>
              <th className="px-6 py-3 text-center">Events</th>
              <th className="px-6 py-3 text-center">PRs</th>
              <th className="px-6 py-3 text-center">Avg Improvement</th>
              <th className="px-6 py-3 text-center">Best Improvement</th>
              <th className="px-6 py-3 text-center">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
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
  );
};
