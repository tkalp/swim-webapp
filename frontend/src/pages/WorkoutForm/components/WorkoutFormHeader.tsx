// components/WorkoutFormHeader.tsx
import { ArrowLeft, Save, FileText, CheckCircle } from "lucide-react";
import { Button } from '@/components/ui';

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
    <div className="shrink-0 bg-slate-900/50 backdrop-blur-sm border-b-2 border-cyan-500/20">
      <div className="max-w-[1800px] mx-auto px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0 flex-1">
          <Button 
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />}
            onClick={onCancel}
            className="touch-manipulation px-2 sm:px-3"
          >
            <span className="hidden sm:inline">Cancel</span>
          </Button>
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-cyan-400 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent truncate">
                {isEditMode ? "Edit Workout" : "Create Workout"}
              </h1>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          form="workout-form"
          variant="primary"
          size="md"
          icon={success ? <CheckCircle size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Save size={16} className="sm:w-[18px] sm:h-[18px]" />}
          loading={loading}
          loadingText={isEditMode ? 'Updating...' : 'Saving...'}
          disabled={!isValid}
          className="touch-manipulation min-w-[80px] sm:min-w-[90px] px-3 sm:px-4 text-sm"
        >
          <span className="hidden sm:inline">{success ? (isEditMode ? 'Updated!' : 'Saved!') : (isEditMode ? 'Update' : 'Save')}</span>
          <span className="sm:hidden">{success ? '✓' : (isEditMode ? 'Update' : 'Save')}</span>
        </Button>
      </div>
    </div>
  );
}
