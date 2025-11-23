// components/WorkoutDescriptionTextarea.tsx
type WorkoutDescriptionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
};

export function WorkoutDescriptionTextarea({ value, onChange }: WorkoutDescriptionTextareaProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = target.value.substring(0, start) + '\t' + target.value.substring(end);
      onChange(newValue);
      
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background-card rounded-lg md:rounded-xl p-3 md:p-4 border border-border overflow-hidden">
      <label htmlFor="description" className="block text-xs md:text-sm font-medium text-text-primary mb-1.5 md:mb-2 shrink-0">
        Workout Description *
      </label>
      <textarea
        id="description"
        className="flex-1 w-full px-3 py-2.5 md:px-4 md:py-3 bg-background-elevated border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none font-mono text-xs md:text-sm min-h-0"
        placeholder={"Warm-up: 400m easy freestyle\nMain Set: 8 x 50m freestyle @ 1:00\nCool-down: 200m easy choice"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        required
      />
      <p className="text-[10px] md:text-xs text-text-secondary mt-1.5 md:mt-2 shrink-0">
        Use Tab for indentation. Separate warm-up, main set, and cool-down sections.
      </p>
    </div>
  );
}
