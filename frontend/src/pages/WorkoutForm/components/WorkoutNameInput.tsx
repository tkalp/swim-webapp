// components/WorkoutNameInput.tsx
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui';

type WorkoutNameInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onGenerateTitle?: () => void;
  generatingTitle?: boolean;
  canGenerateTitle?: boolean;
};

export function WorkoutNameInput({ 
  value, 
  onChange, 
  autoFocus,
  onGenerateTitle,
  generatingTitle,
  canGenerateTitle = false,
}: WorkoutNameInputProps) {
  return (
    <div className="bg-background-elevated rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-text-primary">
          Workout Name
        </label>
        {onGenerateTitle && (
          <button
            type="button"
            onClick={onGenerateTitle}
            disabled={generatingTitle || !canGenerateTitle}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingTitle ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                AI Generate
              </>
            )}
          </button>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Sprint Training Session, Endurance Set"
        autoFocus={autoFocus}
        className="w-full px-3 py-2 bg-background-tertiary/50 border border-border/40 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
      />
    </div>
  );
}
