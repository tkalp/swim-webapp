import React from 'react';

interface ConsistencyBarProps {
  score: number; // 0-100
}

export const ConsistencyBar: React.FC<ConsistencyBarProps> = ({ score }) => {
  // Normalize score to 0-100 range
  const percentage = Math.max(0, Math.min(100, score));
  
  // Determine color based on score
  const getColor = (score: number): string => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getGlowColor = (score: number): string => {
    if (score >= 80) return 'shadow-emerald-500/50';
    if (score >= 60) return 'shadow-yellow-500/50';
    return 'shadow-orange-500/50';
  };

  return (
    <div 
      className="relative w-12 h-2 bg-slate-700/50 rounded-full overflow-hidden"
      title={`Consistency: ${percentage.toFixed(0)}%`}
    >
      {/* Progress fill */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${getColor(percentage)} ${getGlowColor(percentage)} shadow-sm`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};
