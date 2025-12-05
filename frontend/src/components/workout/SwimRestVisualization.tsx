import { Clock, Waves, Coffee } from 'lucide-react';

interface SwimRestVisualizationProps {
  swimTimeMinutes: number;
  restTimeMinutes: number;
  totalDurationMinutes: number;
}

export default function SwimRestVisualization({
  swimTimeMinutes,
  restTimeMinutes,
  totalDurationMinutes,
}: SwimRestVisualizationProps) {
  const swimPercentage = (swimTimeMinutes / totalDurationMinutes) * 100;
  const restPercentage = (restTimeMinutes / totalDurationMinutes) * 100;

  // Workout density classification
  let densityLabel = '';
  let densityColor = '';
  if (swimPercentage >= 80) {
    densityLabel = 'High Density';
    densityColor = 'text-red-400';
  } else if (swimPercentage >= 65) {
    densityLabel = 'Medium Density';
    densityColor = 'text-yellow-400';
  } else {
    densityLabel = 'Low Density';
    densityColor = 'text-green-400';
  }

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <Clock size={20} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Workout Density</h3>
            <p className="text-xs text-slate-400">Swim vs Rest time breakdown</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${densityColor}`}>{densityLabel}</p>
          <p className="text-xs text-slate-400">{totalDurationMinutes} min total</p>
        </div>
      </div>

      {/* Swim Time Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Waves size={16} className="text-cyan-400" />
            <span className="text-sm font-medium text-slate-300">Swimming Time</span>
          </div>
          <span className="text-sm font-bold text-white">{swimTimeMinutes} min</span>
        </div>
        <div className="relative h-8 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700/50">
          <div 
            className="absolute inset-y-0 left-0 bg-linear-to-r from-cyan-500 to-blue-500 flex items-center justify-end pr-2 transition-all duration-500"
            style={{ width: `${swimPercentage}%` }}
          >
            {swimPercentage > 15 && (
              <span className="text-xs font-bold text-white drop-shadow-lg">
                {swimPercentage.toFixed(1)}%
              </span>
            )}
          </div>
          {swimPercentage <= 15 && (
            <span className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-400">
              {swimPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Rest Time Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Coffee size={16} className="text-purple-400" />
            <span className="text-sm font-medium text-slate-300">Rest Time</span>
          </div>
          <span className="text-sm font-bold text-white">{restTimeMinutes} min</span>
        </div>
        <div className="relative h-8 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700/50">
          <div 
            className="absolute inset-y-0 left-0 bg-linear-to-r from-purple-500 to-pink-500 flex items-center justify-end pr-2 transition-all duration-500"
            style={{ width: `${restPercentage}%` }}
          >
            {restPercentage > 15 && (
              <span className="text-xs font-bold text-white drop-shadow-lg">
                {restPercentage.toFixed(1)}%
              </span>
            )}
          </div>
          {restPercentage <= 15 && (
            <span className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-400">
              {restPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* Combined Visualization */}
      <div className="pt-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-400 mb-2">Overall Time Distribution</p>
        <div className="relative h-4 bg-slate-900/50 rounded-full overflow-hidden border border-slate-700/50">
          <div 
            className="absolute inset-y-0 left-0 bg-linear-to-r from-cyan-500 to-blue-500"
            style={{ width: `${swimPercentage}%` }}
          />
          <div 
            className="absolute inset-y-0 bg-linear-to-r from-purple-500 to-pink-500"
            style={{ left: `${swimPercentage}%`, width: `${restPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-linear-to-r from-cyan-500 to-blue-500" />
            <span className="text-xs text-slate-400">Swim</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-linear-to-r from-purple-500 to-pink-500" />
            <span className="text-xs text-slate-400">Rest</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
        <p className="text-xs text-slate-300 leading-relaxed">
          {swimPercentage >= 80 && "High-intensity workout with minimal rest - great for race simulation and conditioning."}
          {swimPercentage >= 65 && swimPercentage < 80 && "Balanced workout with moderate rest periods - ideal for technique and endurance development."}
          {swimPercentage < 65 && "Lower density workout with longer rest intervals - perfect for quality-focused training and recovery."}
        </p>
      </div>
    </div>
  );
}
