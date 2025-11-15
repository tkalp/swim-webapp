import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { EventSummary, formatTimeFromSeconds } from '../../../features/squads/metricsApi';
import { formatEventName, formatActivity, getActivityBadgeStyles } from './utils';

interface EventProgressModalProps {
  event: EventSummary;
  swimmerName: string;
  onClose: () => void;
}

export const EventProgressModal: React.FC<EventProgressModalProps> = ({
  event,
  swimmerName,
  onClose,
}) => {
  const chartData = useMemo(() => {
    const sortedTimeline = [...event.timeline].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sortedTimeline.map(t => ({
      date: new Date(t.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      time: t.time,
      bestTime: event.best_time,
    }));
  }, [event]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background-elevated border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-text-secondary mb-1">{payload[0].payload.date}</p>
          <p className="text-sm font-semibold text-primary">
            Time: {formatTimeFromSeconds(payload[0].value)}
          </p>
          {payload[1] && (
            <p className="text-sm text-text-secondary">
              Best: {formatTimeFromSeconds(payload[1].value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background-elevated border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-text-primary">
                {formatEventName(event.event)}
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getActivityBadgeStyles(event.activity)}`}>
                {formatActivity(event.activity)}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{swimmerName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-border bg-background/50">
          <div className="text-center">
            <div className="text-xs text-text-secondary mb-1">Attempts</div>
            <div className="text-lg font-bold text-text-primary">{event.attempts}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-text-secondary mb-1">First Time</div>
            <div className="text-lg font-bold text-text-primary font-mono">
              {formatTimeFromSeconds(event.first_time)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-text-secondary mb-1">Best Time</div>
            <div className="text-lg font-bold text-primary font-mono">
              {formatTimeFromSeconds(event.best_time)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-text-secondary mb-1">Improvement</div>
            <div className={`text-lg font-bold font-mono ${
              event.improvement_pct < 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {event.improvement_pct < 0 ? '' : '+'}{event.improvement_pct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(75, 85, 99, 0.2)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgb(156, 163, 175)"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  reversed
                  stroke="rgb(156, 163, 175)"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => formatTimeFromSeconds(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '12px', color: 'rgb(156, 163, 175)' }}
                />
                <ReferenceLine 
                  y={event.best_time} 
                  stroke="rgb(245, 158, 11)" 
                  strokeDasharray="5 5"
                  label={{ value: 'Best', fill: 'rgb(245, 158, 11)', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="time"
                  stroke="rgb(49, 151, 167)"
                  strokeWidth={2}
                  dot={{ fill: 'rgb(49, 151, 167)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
