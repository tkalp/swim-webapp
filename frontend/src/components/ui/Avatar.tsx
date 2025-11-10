// components/ui/Avatar.tsx
type AvatarProps = {
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'w-12 h-12 text-base',
  md: 'w-16 h-16 sm:w-18 sm:h-18 text-xl sm:text-2xl',
  lg: 'w-24 h-24 text-3xl',
};

export default function Avatar({ 
  firstName, 
  lastName, 
  size = 'md',
  className = '' 
}: AvatarProps) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;

  return (
    <div className={`relative group ${className}`}>
      <div className={`
        ${sizeClasses[size]}
        rounded-xl 
        bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 
        flex items-center justify-center 
        font-bold text-primary 
        border-2 border-primary/40 
        shadow-lg 
        group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-primary/20
        transition-all duration-300
      `}>
        {initials}
      </div>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
}
