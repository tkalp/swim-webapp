import React from 'react';
import { TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { EventSummary, formatTimeFromSeconds } from '@/services/metricsService';
import { formatEventName, getActivityBadgeStyles, formatActivity } from '@/components/squad/performance/utils';

interface EventCardProps {
  event: EventSummary;
  onClick?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const eventImprovement = event.improvement_pct;
  const eventImproving = eventImprovement < 0;

  return (
    <div 
      className="bg-background-elevated border border-border rounded-lg p-4 hover:border-primary/50 transition-all cursor-pointer hover:shadow-lg"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="font-medium text-text-primary text-sm">
              {formatEventName(event.event)}
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getActivityBadgeStyles(event.activity)}`}>
              {formatActivity(event.activity)}
            </span>
          </div>
          <div className="text-xs text-text-secondary">
            {event.attempts} attempts
          </div>
        </div>
        {event.personal_records > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 rounded text-yellow-400 text-xs">
            <Trophy className="w-3 h-3" />
            {event.personal_records}
          </div>
        )}
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-text-secondary">First:</span>
          <span className="text-text-primary font-mono">
            {formatTimeFromSeconds(event.first_time)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Best:</span>
          <span className="text-primary font-mono font-semibold">
            {formatTimeFromSeconds(event.best_time)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Latest:</span>
          <span className="text-text-primary font-mono">
            {formatTimeFromSeconds(event.latest_time)}
          </span>
        </div>
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Change:</span>
            <div className="flex items-center gap-1">
              {eventImproving ? (
                <TrendingDown className="w-3 h-3 text-green-400" />
              ) : (
                <TrendingUp className="w-3 h-3 text-red-400" />
              )}
              <span className={`font-semibold ${
                eventImproving ? 'text-green-400' : 'text-red-400'
              }`}>
                {eventImproving ? '' : '+'}{eventImprovement.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
