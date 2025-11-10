// components/ui/Badge.tsx
type BadgeVariant = 'default' | 'primary' | 'accent';

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-background-tertiary border-border/60 text-text-primary',
  primary: 'bg-gradient-to-r from-primary/30 to-accent/30 border-primary/50 text-primary font-semibold',
  accent: 'bg-gradient-to-r from-accent/30 to-primary/30 border-accent/50 text-accent font-semibold',
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
