// components/workout/WorkoutBreakdownLegend.tsx
import { Info } from 'lucide-react';

const STROKE_COLORS: Record<string, string> = {
  freestyle: '#22D3EE',
  backstroke: '#8B5CF6', 
  breaststroke: '#10B981',
  butterfly: '#F59E0B',
  individualMedley: '#EF4444',
  choice: '#6B7280'
};

const ACTIVITY_COLORS: Record<string, string> = {
  swim: '#22D3EE',
  kick: '#EF4444',
  pull: '#10B981', 
  drill: '#F59E0B'
};

const STROKE_LABELS: Record<string, string> = {
  freestyle: 'Freestyle',
  backstroke: 'Backstroke',
  breaststroke: 'Breaststroke',
  butterfly: 'Butterfly',
  individualMedley: 'IM',
  choice: 'Choice'
};

const ACTIVITY_LABELS: Record<string, string> = {
  swim: 'Swim',
  kick: 'Kick',
  pull: 'Pull',
  drill: 'Drill'
};

export default function WorkoutBreakdownLegend() {
  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={16} className="text-primary" />
        <h4 className="text-sm font-semibold text-slate-100">Workout Breakdown Legend</h4>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Strokes Legend */}
        <div className="flex-1">
          <h5 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Strokes</h5>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STROKE_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-slate-400">
                  {STROKE_LABELS[key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activities Legend */}
        <div className="flex-1">
          <h5 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Activities</h5>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ACTIVITY_COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-slate-400">
                  {ACTIVITY_LABELS[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <p className="text-xs text-slate-500 mt-3">
        Charts show the breakdown of workout composition by meters for sessions with workout data.
      </p>
    </div>
  );
}
