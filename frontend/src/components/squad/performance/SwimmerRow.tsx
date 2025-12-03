import React, { useState } from 'react';
import { Trophy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SwimmerPerformance } from '@/services/metricsService';
import { getSwimmerInitials, getConsistencyColor, formatConsistencyScore, getWeightedImprovementColor, formatWeightedImprovement, formatTrendVelocity } from '@/components/squad/performance/utils';
import { EventCard } from '@/components/squad/performance/EventCard';
import { ConsistencyBar } from '@/components/squad/performance/ConsistencyBar';
import AttemptsModal from '@/components/swimmers/bestTimes/AttemptsModal';
import type { EventQuery } from '@/services/workoutResultService';

interface SwimmerRowProps {
  swimmer: SwimmerPerformance;
  isExpanded: boolean;
  onToggle: () => void;
}

export const SwimmerRow: React.FC<SwimmerRowProps> = ({
  swimmer,
  isExpanded,
  onToggle,
}) => {
  const isImproving = swimmer.avg_improvement_pct < 0;
  const navigate = useNavigate();
  const [selectedEventQuery, setSelectedEventQuery] = useState<EventQuery | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  
  const INITIAL_EVENTS_COUNT = 4;
  const visibleEvents = showAllEvents ? swimmer.events : swimmer.events.slice(0, INITIAL_EVENTS_COUNT);
  const hasMoreEvents = swimmer.events.length > INITIAL_EVENTS_COUNT;

  const handleGoToSwimmer = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row toggle
    navigate(`/swimmers/${swimmer.swimmer_id}`);
  };

  const handleEventClick = (index: number) => {
    const event = swimmer.events[index];
    
    // Parse event key to build EventQuery
    // Event key format: "{distance}M_{stroke}_{activity}_{result_units}_{equipment?}"
    const parts = event.event.split('_');
    const distanceStr = parts[0]; // e.g., "100M"
    const distance = parseInt(distanceStr.replace('M', ''));
    const stroke = parts[1] || 'free';
    const activity = parts[2] || 'swim';
    const resultUnits = (parts[3] || 'SCM') as 'SCM' | 'LCM';
    const equipment = parts[4] || 'none';
    
    const eventQuery: EventQuery = {
      swimmerId: swimmer.swimmer_id,
      distance,
      stroke,
      activity,
      equipment,
      units: 'meters',
      resultUnits
    };
    
    console.log('[DEBUG] Opening event modal with query:', eventQuery);
    setSelectedEventQuery(eventQuery);
  };

  const handleCloseModal = () => {
    console.log('[DEBUG] Closing event modal');
    setSelectedEventQuery(null);
  };

  return (
    <React.Fragment>
      {/* Main row */}
      <tr 
        className="hover:bg-background cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {getSwimmerInitials(swimmer.swimmer_name)}
              </span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-100">{swimmer.swimmer_name}</div>
              <div className="text-xs text-slate-400">
                {isExpanded ? 'Hide' : 'View'} event breakdown
              </div>
            </div>
            <button
              onClick={handleGoToSwimmer}
              className="px-2 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded transition-colors flex items-center gap-1"
              title="Go to swimmer profile"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">View</span>
            </button>
          </div>
        </td>
        <td className="px-6 py-4 text-center text-slate-100">
          {swimmer.events_analyzed}
        </td>
        <td className="px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-semibold">
              {swimmer.personal_records}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          <span className={`font-semibold ${
            isImproving ? 'text-green-400' : 'text-red-400'
          }`}>
            {swimmer.avg_improvement_pct.toFixed(1)}%
          </span>
        </td>
        <td className="px-6 py-4 text-center">
          <span className={`font-semibold ${
            swimmer.best_improvement_pct < 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {swimmer.best_improvement_pct.toFixed(1)}%
          </span>
        </td>
        <td className="px-6 py-4 text-center hidden md:table-cell">
          <div className="flex items-center justify-center">
            <ConsistencyBar score={swimmer.consistency_score ?? 0} />
          </div>
        </td>
        <td className="px-6 py-4 text-center hidden lg:table-cell">
          <span className={`font-semibold ${getWeightedImprovementColor(swimmer.weighted_improvement_pct)}`}>
            {formatWeightedImprovement(swimmer.weighted_improvement_pct)}
          </span>
        </td>
        <td className="px-6 py-4 text-center">
          {(() => {
            const trend = formatTrendVelocity(swimmer.trend_velocity_per_day);
            return (
              <span className={`font-semibold text-lg ${trend.color}`} title={trend.label}>
                {trend.icon}
              </span>
            );
          })()}
        </td>
      </tr>

      {/* Expanded event details */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-6 py-3 bg-slate-900/40">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Event Performance ({swimmer.events.length} events)
                </h4>
                {hasMoreEvents && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllEvents(!showAllEvents);
                    }}
                    className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-500/30"
                  >
                    {showAllEvents ? '− Show less' : `+ Show all ${swimmer.events.length} events`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {visibleEvents.map((event, idx) => (
                  <EventCard 
                    key={idx} 
                    event={event} 
                    onClick={() => handleEventClick(idx)}
                  />
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Event Attempts Modal */}
      {selectedEventQuery && (
        <>
          <AttemptsModal
            open={!!selectedEventQuery}
            onClose={handleCloseModal}
            query={selectedEventQuery}
            canManageResults={false}
          />
        </>
      )}
    </React.Fragment>
  );
};



