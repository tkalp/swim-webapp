// components/ErrorAlert.tsx
import { AlertCircle } from "lucide-react";

type ErrorAlertProps = {
  error: string;
  onDismiss: () => void;
};

export function ErrorAlert({ error, onDismiss }: ErrorAlertProps) {
  if (!error) return null;

  return (
    <div className="flex-shrink-0 mx-4 mt-4 bg-danger/10 border border-danger/30 rounded-lg p-3 flex items-start gap-3">
      <AlertCircle size={18} className="text-danger flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <strong className="text-danger font-semibold">Error</strong>
        <p className="text-text-secondary text-sm mt-1">{error}</p>
      </div>
      <button 
        className="text-text-secondary hover:text-text-primary transition-colors"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
