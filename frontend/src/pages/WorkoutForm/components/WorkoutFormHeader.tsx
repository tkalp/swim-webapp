// components/WorkoutFormHeader.tsx
import { ArrowLeft, Save, FileText, CheckCircle } from "lucide-react";

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
    <div className="flex-shrink-0 bg-background-elevated border-b border-border">
      <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            onClick={onCancel}
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Cancel</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileText size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                {isEditMode ? "Edit Workout" : "Create Workout"}
              </h1>
            </div>
          </div>
        </div>

        <button
          type="submit"
          form="workout-form"
          className="px-4 py-2 bg-gradient-to-r from-primary-dark via-primary to-accent text-white rounded-lg font-medium hover:scale-105 hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
