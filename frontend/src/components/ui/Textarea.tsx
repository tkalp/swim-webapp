// components/ui/Textarea.tsx
import { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, required, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label 
            htmlFor={textareaId}
            className="text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {label}
            {required && <span className="text-cyan-400 ml-1">*</span>}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-4 py-2.5 
            bg-slate-800 border-2 
            ${error ? 'border-red-500/50' : 'border-slate-700/50'}
            rounded-xl 
            text-slate-100 placeholder:text-slate-500
            font-medium text-sm
            transition-all duration-200
            focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/30
            disabled:opacity-50 disabled:cursor-not-allowed
            resize-vertical
            min-h-[120px]
            ${className}
          `.trim()}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          required={required}
          {...props}
        />
        
        {error && (
          <p id={`${textareaId}-error`} className="text-xs text-red-400 font-medium" role="alert">{error}</p>
        )}
        
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="text-xs text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
