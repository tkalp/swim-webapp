// components/ui/Select.tsx
import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, className = '', id, required, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label 
            htmlFor={selectId}
            className="text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {label}
            {required && <span className="text-cyan-400 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full px-4 py-2.5 pr-10
              bg-slate-800 border-2 
              ${error ? 'border-red-500/50' : 'border-slate-700/50'}
              rounded-xl 
              text-slate-100
              font-medium text-sm
              transition-all duration-200
              focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              appearance-none cursor-pointer
              ${className}
            `.trim()}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
            required={required}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <ChevronDown 
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" 
          />
        </div>
        
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-red-400 font-medium" role="alert">{error}</p>
        )}
        
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-xs text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
