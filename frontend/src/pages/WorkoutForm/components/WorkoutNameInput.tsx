// components/WorkoutNameInput.tsx
type WorkoutNameInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

export function WorkoutNameInput({ value, onChange, autoFocus }: WorkoutNameInputProps) {
  return (
    <div className="bg-background-card rounded-lg md:rounded-xl p-3 md:p-4 border border-border shrink-0">
      <label htmlFor="name" className="block text-xs md:text-sm font-medium text-text-primary mb-1.5 md:mb-2">
        Workout Name *
      </label>
      <input
        id="name"
        type="text"
        className="w-full px-3 py-2 md:px-4 md:py-2.5 bg-background-elevated border border-border rounded-lg text-sm md:text-base text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        placeholder="e.g., Sprint Training Session, Endurance Set"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoFocus={autoFocus}
      />
    </div>
  );
}
