// components/EffortLevelSlider.tsx
type EffortLevelSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export function EffortLevelSlider({ value, onChange }: EffortLevelSliderProps) {
  return (
    <div className="bg-background-card rounded-xl p-4 border border-border flex-shrink-0">
      <label htmlFor="effort" className="block text-sm font-medium text-text-primary mb-2">
        Effort Level: <span className="text-primary font-semibold">{value}/10</span>
      </label>
      <input
        id="effort"
        type="range"
        className="w-full h-2 bg-background-elevated rounded-lg appearance-none cursor-pointer accent-primary"
        min="1"
        max="10"
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="flex justify-between text-xs text-text-secondary mt-2">
        <span>Easy</span>
        <span>Moderate</span>
        <span>Hard</span>
      </div>
    </div>
  );
}
