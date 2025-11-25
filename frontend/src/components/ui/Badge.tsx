// components/ui/Badge.tsx
type BadgeVariant = 'default' | 'primary' | 'accent';

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-800/50 border-slate-700/60 text-slate-200',
  primary: 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50 text-cyan-400 font-semibold',
  accent: 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-purple-500/50 text-purple-400 font-semibold',
};

export default function Badge({ 
  children, 
  variant = 'default',
  className = '' 
}: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center 
      px-2.5 py-1 
      rounded-lg 
      border 
      text-xs 
      font-medium
      ${variantClasses[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
}
