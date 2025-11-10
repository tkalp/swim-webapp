import { useState, useEffect } from 'react';

type StackedBarData = {
  label: string;
  value: number;
  color: string;
  percentage: number;
};

type StackedBarChartProps = {
  title: string;
  data: StackedBarData[];
  height?: number;
  showLabels?: boolean;
  className?: string;
};

export default function StackedBarChart({ 
  title, 
  data, 
  height = 40, 
  showLabels = true,
  className = ''
}: StackedBarChartProps) {
  const [isAnimated, setIsAnimated] = useState(false);
  const validData = data.filter(item => item.value > 0);
  
  // Trigger animation after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimated(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [data]);
  
  if (validData.length === 0) {
    return (
      <div className={`stacked-chart-container ${className}`}>
        <div className="stacked-chart-title">{title}</div>
        <div className="stacked-chart-empty">No data available</div>
      </div>
    );
  }

  return (
    <div className={`stacked-chart-container ${className}`}>
      <div className="stacked-chart-title">{title}</div>
      
      {/* Stacked Bar */}
      <div className="stacked-bar" style={{ height: `${height}px` }}>
        {validData.map((item, index) => (
          <div
            key={item.label}
            className={`stacked-segment ${isAnimated ? 'stacked-segment-animated' : ''}`}
            style={{
              width: isAnimated ? `${item.percentage}%` : '0%',
              backgroundColor: item.color,
              animationDelay: `${index * 150}ms`, // Staggered animation
            }}
            title={`${item.label}: ${item.value}m (${item.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      {showLabels && (
        <div className={`stacked-legend ${isAnimated ? 'stacked-legend-animated' : ''}`}>
          {validData.map((item, index) => (
            <div 
              key={item.label} 
              className="legend-item"
              style={{
                animationDelay: `${(validData.length * 150) + (index * 100)}ms`, // After bars finish
              }}
            >
              <div 
                className="legend-dot" 
                style={{ backgroundColor: item.color }}
              />
              <span className="legend-label">
                {item.label} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}