// components/ui/Input.tsx
import { forwardRef } from 'react';
import { Mail, Lock, User, Search, Calendar } from 'lucide-react';

type IconType = 'mail' | 'lock' | 'user' | 'search' | 'calendar';

const iconMap: Record<IconType, React.ReactNode> = {
  mail: <Mail size={20} />,
  lock: <Lock size={20} />,
  user: <User size={20} />,
  search: <Search size={20} />,
  calendar: <Calendar size={20} />,
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconType | React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', id, required, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasIcon = !!icon;
    const iconElement = typeof icon === 'string' ? iconMap[icon as IconType] : icon;
    
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label 
            htmlFor={inputId}
            className="text-xs font-semibold text-slate-400 uppercase tracking-wide"
          >
            {label}
            {required && <span className="text-cyan-400 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {hasIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {iconElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full ${hasIcon ? 'pl-12 pr-4' : 'px-4'} py-2.5 
              bg-slate-800 border-2 
              ${error ? 'border-red-500/50' : 'border-slate-700/50'}
              rounded-xl 
              text-slate-100 placeholder:text-slate-500
              font-medium text-sm
              transition-all duration-200
              focus:outline-none focus:border-cyan-500/70 focus:ring-4 focus:ring-cyan-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}
            `.trim()}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            required={required}
            {...props}
          />
        </div>
        
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-400 font-medium" role="alert">{error}</p>
        )}
        
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
