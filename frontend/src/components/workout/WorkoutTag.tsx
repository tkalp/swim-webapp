// components/workout/WorkoutTag.tsx
import { X } from 'lucide-react';
import type { WorkoutTag as WorkoutTagType } from '../../types/workoutTags';

interface WorkoutTagProps {
  tag: WorkoutTagType;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  clickable?: boolean;
  onClick?: () => void;
}

export function WorkoutTag({ tag, onRemove, size = 'md', clickable = false, onClick }: WorkoutTagProps) {
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-3 py-1 text-sm';

  const Component = clickable || onClick ? 'button' : 'span';

  return (
    <Component
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border transition-all ${sizeClasses} ${
        clickable || onClick ? 'hover:scale-105 cursor-pointer' : ''
      }`}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: `${tag.color}40`,
      }}
    >
      <span>{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 transition-opacity ml-0.5"
          type="button"
        >
          <X size={size === 'sm' ? 12 : 14} />
        </button>
      )}
    </Component>
  );
}
