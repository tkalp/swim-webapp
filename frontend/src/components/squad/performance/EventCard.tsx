import React from 'react';
import { TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { EventSummary, formatTimeFromSeconds } from '@/services/metricsService';
import { formatEventName, getActivityBadgeStyles, formatActivity, getConsistencyColor, formatConsistencyScore, formatTrendVelocity } from '@/components/squad/performance/utils';

interface EventCardProps {
  event: EventSummary;
  onClick?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const eventImprovement = event.improvement_pct;
  const eventImproving = eventImprovement < 0;
  const trend = formatTrendVelocity(event.trend_velocity_per_day);

  return (
    <div 
      className="relative group bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 hover:border-cyan-500/50 rounded-lg p-2.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:shadow-cyan-500/10 overflow-hidden"
      onClick={onClick}
      title={formatEventName(event.event)}
    >
      {/* Top accent bar */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      {/* Header: Event name + PR badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h5 className="font-semibold text-slate-100 text-xs truncate group-hover:text-cyan-400 transition-colors" title={formatEventName(event.event)}>
            {formatEventName(event.event).replace('Meter', 'M').replace('Individual Medley', 'IM')}
          </h5>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getActivityBadgeStyles(event.activity)}`}>
              {formatActivity(event.activity)}
            </span>
            <span className="text-[10px] text-slate-500">
              {event.attempts} att.
            </span>
          </div>
        </div>
        {event.personal_records > 0 && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-yellow-400">
            <Trophy className="w-2.5 h-2.5" />
            <span className="text-[10px] font-bold">{event.personal_records}</span>
          </div>
        )}
      </div>
      
      {/* Compact metrics grid */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        {/* Best Time */}
        <div className="bg-slate-900/40 rounded px-1.5 py-1">
          <div className="text-slate-500 font-medium mb-0.5">Best</div>
          <div className="text-cyan-400 font-mono font-bold text-xs">
            {formatTimeFromSeconds(event.best_time)}
          </div>
        </div>
        
        {/* Improvement */}
        <div className="bg-slate-900/40 rounded px-1.5 py-1">
          <div className="text-slate-500 font-medium mb-0.5">Change</div>
          <div className={`font-bold text-xs flex items-center gap-0.5 ${
            eventImproving ? 'text-emerald-400' : 'text-orange-400'
          }`}>
            {eventImproving ? (
              <TrendingDown className="w-2.5 h-2.5" />
            ) : (
              <TrendingUp className="w-2.5 h-2.5" />
            )}
            <span>{eventImprovement.toFixed(1)}%</span>
          </div>
        </div>
        
        {/* Consistency */}
        <div className="bg-slate-900/40 rounded px-1.5 py-1">
          <div className="text-slate-500 font-medium mb-0.5">Consist.</div>
          <div className={`font-bold text-xs ${getConsistencyColor(event.consistency_score)}`}>
            {formatConsistencyScore(event.consistency_score)}
          </div>
        </div>
      </div>

      {/* Optional bottom metrics row */}
      {event.trend_velocity_per_day !== undefined && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-700/50 flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Trend:</span>
          <span className={`font-bold ${trend.color}`}>
            {trend.icon}
          </span>
        </div>
      )}
    </div>
  );
};

