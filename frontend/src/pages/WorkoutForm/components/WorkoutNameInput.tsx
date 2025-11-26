// components/WorkoutNameInput.tsx
import { Input } from '@/components/ui';

type WorkoutNameInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

export function WorkoutNameInput({ value, onChange, autoFocus }: WorkoutNameInputProps) {
  return (
    <Input
      label="Workout Name"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g., Sprint Training Session, Endurance Set"
      autoFocus={autoFocus}
    />
  );
}
