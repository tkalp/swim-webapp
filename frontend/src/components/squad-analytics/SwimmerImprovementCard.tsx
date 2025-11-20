import React from 'react';
import { SwimmerPerformance } from '../../services/metricsService';
import { TrendingDown, TrendingUp, Activity, Trophy, Target } from 'lucide-react';

interface SwimmerImprovementCardProps {
  swimmer: SwimmerPerformance;
  isSelected?: boolean;
  onClick?: () => void;
}

export const SwimmerImprovementCard: React.FC<SwimmerImprovementCardProps> = ({
  swimmer,
  isSelected = false,
  onClick,
}) => {
  // Calculate summary stats - use properties from SwimmerPerformance interface
  const totalWorkouts = swimmer.total_workouts;
  const eventsAnalyzed = swimmer.events_analyzed;
  const totalPRs = swimmer.personal_records;

  // Determine if swimmer is improving (negative improvement % = faster times)
  const isImproving = swimmer.avg_improvement_pct < 0;
  const improvementAbs = Math.abs(swimmer.avg_improvement_pct);

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg p-4 cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-linear-to-br from-cyan-500/20 to-purple-500/20 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20' 
          : 'bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600'
        }
      `}
      onClick={onClick}
    >
      {/* Gradient border effect when selected */}
      {isSelected && (
        <div className="absolute inset-0 bg-linear-to-br from-cyan-500 to-purple-500 opacity-10 pointer-events-none" />
      )}

      <div className="relative z-10">
        {/* Swimmer name */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white truncate">
            {swimmer.swimmer_name}
          </h3>
          {isImproving ? (
            <TrendingDown className="w-5 h-5 text-green-400 shrink-0 ml-2" />
          ) : (
            <TrendingUp className="w-5 h-5 text-red-400 shrink-0 ml-2" />
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Total workouts */}
          <div className="flex items-center gap-2 text-gray-300">
            <Activity className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-xs text-gray-400">Workouts</div>
              <div className="text-sm font-semibold">{totalWorkouts}</div>
            </div>
          </div>

          {/* Events analyzed */}
          <div className="flex items-center gap-2 text-gray-300">
            <Target className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-xs text-gray-400">Events</div>
              <div className="text-sm font-semibold">{eventsAnalyzed}</div>
            </div>
          </div>

          {/* PRs broken */}
          <div className="flex items-center gap-2 text-gray-300">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <div>
              <div className="text-xs text-gray-400">PRs</div>
              <div className="text-sm font-semibold">{totalPRs}</div>
            </div>
          </div>

          {/* Average improvement */}
          <div className="flex items-center gap-2 text-gray-300">
            <div className={`w-4 h-4 flex items-center justify-center text-xs font-bold rounded ${
              isImproving ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              %
            </div>
            <div>
              <div className="text-xs text-gray-400">Avg Change</div>
              <div className={`text-sm font-semibold ${
                isImproving ? 'text-green-400' : 'text-red-400'
              }`}>
                {isImproving ? '-' : '+'}{improvementAbs.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Event badges - show top 3 events */}
        <div className="flex flex-wrap gap-1.5">
          {swimmer.events.slice(0, 3).map((event, index) => (
            <span
              key={index}
              className="px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-300 border border-gray-600"
            >
              {event.event}
            </span>
          ))}
          {swimmer.events.length > 3 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-400">
              +{swimmer.events.length - 3} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
