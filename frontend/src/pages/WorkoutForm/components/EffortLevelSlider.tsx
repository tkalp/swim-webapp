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

  return (
    <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 rounded-lg md:rounded-xl p-3 md:p-4 border border-slate-700/50 shrink-0">
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <label htmlFor="effort" className="text-xs md:text-sm font-semibold text-slate-200">
          Effort Level
        </label>
        <div className="flex items-center gap-2">
          <span className={`text-xs md:text-sm font-medium bg-linear-to-r ${getEffortColor()} bg-clip-text text-transparent`}>
            {getEffortLabel()}
          </span>
          <span className={`text-base md:text-lg font-bold bg-linear-to-r ${getEffortColor()} bg-clip-text text-transparent`}>
            {value}
          </span>
        </div>
      </div>
      <input
        id="effort"
        type="range"
        className="w-full h-2 md:h-2.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, rgb(34 197 94) 0%, rgb(251 146 60) 50%, rgb(239 68 68) 100%)`
        }}
        min="1"
        max="10"
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="flex justify-between text-[10px] md:text-xs text-slate-400 mt-2 md:mt-2.5">
        <span className="text-green-400 font-medium">Easy</span>
        <span className="text-orange-400 font-medium">Moderate</span>
        <span className="text-red-400 font-medium">Hard</span>
      </div>
    </div>
  );
}
