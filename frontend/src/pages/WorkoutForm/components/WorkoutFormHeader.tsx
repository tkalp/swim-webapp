// components/WorkoutFormHeader.tsx
import { ArrowLeft, Save, FileText, Check } from "lucide-react";

type WorkoutFormHeaderProps = {
  isEditMode: boolean;
  isValid: boolean;
  loading: boolean;
  success: boolean;
  onCancel: () => void;
};

export function WorkoutFormHeader({ 
  isEditMode, 
  isValid, 
  loading, 
  success, 
  onCancel 
}: WorkoutFormHeaderProps) {
  return (
    <div className="shrink-0 bg-background-elevated border-b border-border">
      <div className="max-w-[1800px] mx-auto px-3 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <button 
            className="flex items-center gap-1.5 md:gap-2 text-text-secondary hover:text-text-primary transition-colors shrink-0"
            onClick={onCancel}
          >
            <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="text-xs md:text-sm">Cancel</span>
          </button>
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-primary md:w-[18px] md:h-[18px]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-semibold text-text-primary truncate">
                {isEditMode ? "Edit Workout" : "Create Workout"}
              </h1>
            </div>
          </div>
        </div>

        <button
          type="submit"
          form="workout-form"
          className="px-3 py-1.5 md:px-4 md:py-2 bg-linear-to-r from-primary-dark via-primary to-accent text-white rounded-lg text-sm md:text-base font-medium hover:scale-105 hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center gap-1.5 md:gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0"
          disabled={!isValid || loading}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{isEditMode ? 'Updating...' : 'Saving...'}</span>
            </>
          ) : success ? (
            <>
              <CheckCircle size={18} />
              <span>{isEditMode ? 'Updated!' : 'Saved!'}</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>{isEditMode ? 'Update' : 'Save'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
