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
      className="relative group bg-linear-to-br from-slate-900 to-slate-800 backdrop-blur-xl border-2 border-cyan-500/20 hover:border-cyan-500/40 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] overflow-hidden"
      onClick={onClick}
    >
      {/* Accent bars */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-cyan-500/50 via-blue-500/50 to-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-purple-500/50 via-blue-500/50 to-cyan-500/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h5 className="font-semibold text-slate-100 text-sm bg-linear-to-r from-slate-100 to-slate-300 bg-clip-text group-hover:from-cyan-400 group-hover:to-blue-400 transition-all">
              {formatEventName(event.event)}
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${getActivityBadgeStyles(event.activity)}`}>
              {formatActivity(event.activity)}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {event.attempts} {event.attempts === 1 ? 'attempt' : 'attempts'}
          </div>
        </div>
        {event.personal_records > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-linear-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-xs font-semibold shadow-sm">
            <Trophy className="w-3.5 h-3.5" />
            {event.personal_records}
          </div>
        )}
      </div>
      
      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
          <span className="text-slate-400 font-medium">First:</span>
          <span className="text-slate-200 font-mono font-semibold">
            {formatTimeFromSeconds(event.first_time)}
          </span>
        </div>
        <div className="flex justify-between items-center py-1.5 px-2 bg-linear-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg">
          <span className="text-cyan-400 font-medium">Best:</span>
          <span className="text-cyan-400 font-mono font-bold">
            {formatTimeFromSeconds(event.best_time)}
          </span>
        </div>
        <div className="flex justify-between items-center py-1.5 px-2 bg-slate-800/30 rounded-lg">
          <span className="text-slate-400 font-medium">Latest:</span>
          <span className="text-slate-200 font-mono font-semibold">
            {formatTimeFromSeconds(event.latest_time)}
          </span>
        </div>
        <div className="pt-2 mt-2 border-t-2 border-cyan-500/10">
          <div className="flex items-center justify-between py-1.5 px-2 bg-slate-800/40 rounded-lg">
            <span className="text-slate-400 font-medium">Change:</span>
            <div className="flex items-center gap-1.5">
              {eventImproving ? (
                <TrendingDown className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={`font-bold ${
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

