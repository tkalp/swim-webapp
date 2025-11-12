import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

type ToastProps = {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="animate-in slide-in-from-right duration-300">
      <div className={`
        flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm
        ${type === 'success' 
          ? 'bg-success/10 border-success/30 text-success' 
          : 'bg-danger/10 border-danger/30 text-danger'
        }
        max-w-[90vw] sm:max-w-md
      `}>
        <div className="flex-shrink-0 mt-0.5">
          {type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium break-words">
            {message}
          </p>
        </div>

        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
