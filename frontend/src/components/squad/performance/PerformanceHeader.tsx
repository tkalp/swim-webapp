import React from 'react';
import DateInput from '../../ui/DateInput';

interface PerformanceHeaderProps {
  startDate: string;
  endDate: string;
  onDateChange: (field: 'start' | 'end', value: string) => void;
}

export const PerformanceHeader: React.FC<PerformanceHeaderProps> = ({
  startDate,
  endDate,
  onDateChange,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <DateInput
          value={startDate}
          onChange={(value) => onDateChange('start', value)}
          placeholder="Start date"
        />
        <span className="text-text-secondary">to</span>
        <DateInput
          value={endDate}
          onChange={(value) => onDateChange('end', value)}
          placeholder="End date"
        />
      </div>
    </div>
  );
};
