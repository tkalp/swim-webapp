// components/WorkoutDescriptionTextarea.tsx
import { Textarea } from '@/components/ui';

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
    <Textarea
      label="Workout Description"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={"Warm-up: 400m easy freestyle\nMain Set: 8 x 50m freestyle @ 1:00\nCool-down: 200m easy choice"}
      required
      rows={12}
      hint="Use Tab for indentation. Separate warm-up, main set, and cool-down sections."
      className="font-mono text-sm"
    />
  );
}
