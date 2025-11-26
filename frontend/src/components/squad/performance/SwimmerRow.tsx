import React, { useState } from 'react';
import { TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { SwimmerPerformance } from '@/services/metricsService';
import { getSwimmerInitials } from '@/components/squad/performance/utils';
import { EventCard } from '@/components/squad/performance/EventCard';
import { EventProgressModal } from '@/components/squad/performance/EventProgressModal';

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
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);

  const handleEventClick = (index: number) => {
    setSelectedEventIndex(index);
  };

  const handleCloseModal = () => {
    setSelectedEventIndex(null);
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
            <div>
              <div className="font-medium text-slate-100">{swimmer.swimmer_name}</div>
              <div className="text-xs text-slate-400">
                {isExpanded ? 'Hide' : 'View'} event breakdown
              </div>
            </div>
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
        <td className="px-6 py-4 text-center">
          {isImproving ? (
            <TrendingDown className="w-5 h-5 text-green-400 mx-auto" />
          ) : (
            <TrendingUp className="w-5 h-5 text-red-400 mx-auto" />
          )}
        </td>
      </tr>

      {/* Expanded event details */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-6 py-4 bg-background">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Event Performance Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {swimmer.events.map((event, idx) => (
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

      {/* Event Progress Modal */}
      {selectedEventIndex !== null && (
        <EventProgressModal
          event={swimmer.events[selectedEventIndex]}
          swimmerName={swimmer.swimmer_name}
          onClose={handleCloseModal}
        />
      )}
    </React.Fragment>
  );
};



