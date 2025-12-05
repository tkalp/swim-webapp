import { Star } from 'lucide-react';

interface WorkoutRatingStarsProps {
  rating: number | null;
  ratingCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

export default function WorkoutRatingStars({
  rating,
  ratingCount = 0,
  size = 'md',
  showCount = true,
  className = '',
}: WorkoutRatingStarsProps) {
  if (rating === null || rating === 0) {
    return (
      <div className={`flex items-center gap-1 text-slate-500 ${className}`}>
        <Star className={`${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`} />
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          No ratings
        </span>
      </div>
    );
  }

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  const starSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className={`${starSize} fill-yellow-400 text-yellow-400`} />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star className={`${starSize} text-yellow-400`} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className={`${starSize} fill-yellow-400 text-yellow-400`} />
            </div>
          </div>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className={`${starSize} text-slate-600`} />
        ))}
      </div>
      <span className={`font-semibold ${size === 'sm' ? 'text-xs' : 'text-sm'} text-slate-200`}>
        {rating.toFixed(1)}
      </span>
      {showCount && ratingCount > 0 && (
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-slate-400`}>
          ({ratingCount})
        </span>
      )}
    </div>
  );
}
