// components/ui/Button.tsx
import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    loadingText,
    icon,
    fullWidth = false,
    disabled, 
    children, 
    className = '', 
    ...props 
  }, ref) => {
    
    // Base styles - always applied
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';
    
    // Variant styles
    const variantStyles: Record<ButtonVariant, string> = {
      primary: 'bg-linear-to-r from-cyan-500 to-blue-500 text-white hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30 focus:ring-cyan-500/50 active:scale-100',
      secondary: 'bg-slate-800 border-2 border-slate-700/50 text-slate-200 hover:bg-slate-700 hover:border-slate-600/50 hover:scale-[1.02] focus:ring-slate-500/50 active:scale-100',
      ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/50 hover:text-slate-100 focus:ring-slate-500/50',
      danger: 'bg-red-500/10 border-2 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:scale-[1.02] focus:ring-red-500/50 active:scale-100',
      success: 'bg-green-500/10 border-2 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50 hover:scale-[1.02] focus:ring-green-500/50 active:scale-100',
    };
    
    // Size styles
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    
    const widthStyle = fullWidth ? 'w-full' : '';
    
    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`.trim();
    
    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-live={loading ? 'polite' : undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {icon && <span className="inline-flex">{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
