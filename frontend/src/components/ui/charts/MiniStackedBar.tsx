// components/ui/charts/MiniStackedBar.tsx
import { useState, useEffect } from 'react';

type StackedSegment = {
  label: string;
  value: number;
  color: string;
};

type MiniStackedBarProps = {
  segments: StackedSegment[];
  height?: number;
  className?: string;
};

export default function MiniStackedBar({ 
  segments, 
  height = 20, 
  className = '' 
}: MiniStackedBarProps) {
  const [isAnimated, setIsAnimated] = useState(false);
  
  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  
  if (total === 0) {
    return (
      <div 
        className={`bg-background-secondary rounded-full ${className}`}
        style={{ height }}
      >
        <div className="h-full bg-text-muted/20 rounded-full transition-all duration-500 ease-out" />
      </div>
    );
  }

  return (
    <div 
      className={`flex rounded-full overflow-hidden ${className}`}
      style={{ height }}
    >
      {segments.map((segment, index) => {
        const percentage = (segment.value / total) * 100;
        if (percentage < 1) return null; // Don't show segments < 1%
        
        return (
          <div
            key={`${segment.label}-${index}`}
            className="transition-all duration-700 ease-out transform"
            style={{
              width: isAnimated ? `${percentage}%` : '0%',
              backgroundColor: segment.color,
              transitionDelay: `${index * 100}ms`,
            }}
            title={`${segment.label}: ${segment.value}m (${percentage.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}