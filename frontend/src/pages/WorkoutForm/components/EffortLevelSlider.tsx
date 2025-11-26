// components/EffortLevelSlider.tsx
type EffortLevelSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export function EffortLevelSlider({ value, onChange }: EffortLevelSliderProps) {
  // Calculate color based on effort level
  const getEffortColor = () => {
    if (value <= 3.5) return 'from-green-500 to-emerald-500';
    if (value <= 7) return 'from-amber-500 to-orange-500';
    return 'from-orange-500 to-red-500';
  };

  const getEffortLabel = () => {
    if (value <= 3.5) return 'Easy';
    if (value <= 7) return 'Moderate';
    return 'Hard';
  };

  const getProgressColor = () => {
    if (value <= 3.5) return '#10b981';
    if (value <= 7) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 rounded-lg p-3 sm:p-3.5 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <label htmlFor="effort" className="text-xs sm:text-sm font-semibold text-slate-300">
          Effort Level
        </label>
        <div className="flex items-center gap-2">
          <span className={`text-xs sm:text-sm font-medium bg-linear-to-r ${getEffortColor()} bg-clip-text text-transparent`}>
            {getEffortLabel()}
          </span>
          <span className={`text-xl sm:text-2xl font-bold bg-linear-to-r ${getEffortColor()} bg-clip-text text-transparent tabular-nums min-w-[2ch]`}>
            {value}
          </span>
        </div>
      </div>
      
      {/* Modern minimal slider container */}
      <div className="relative mb-2">
        {/* Background track */}
        <div className="h-1.5 sm:h-2 bg-slate-700/50 rounded-full overflow-hidden\">
          {/* Progress fill */}
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${((value - 1) / 9) * 100}%`,
              background: `linear-gradient(to right, ${getProgressColor()}, ${getProgressColor()})`,
              boxShadow: `0 0 10px ${getProgressColor()}40`
            }}
          />
        </div>
        
        {/* Invisible range input overlay */}
        <input
          id="effort"
          type="range"
          className="absolute top-0 left-0 w-full h-1.5 sm:h-2 appearance-none cursor-pointer touch-manipulation bg-transparent opacity-0"
          min="1"
          max="10"
          step="0.5"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
      
      <div className="flex justify-between text-[10px] sm:text-xs text-slate-500 mt-1">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
