// components/workout/WorkoutMiniChart.tsx
import { useState, useEffect } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { getWorkoutTemplate } from '@/services/workoutTemplateService';
import MiniStackedBar from '@/components/ui/charts/MiniStackedBar';

type WorkoutData = {
  id: string;
  name: string;
  total_meters: number;
  json_description?: {
    estimate: {
      totalDistance: number;
      strokeBreakdown: {
        freestyle: number;
        backstroke: number;
        breaststroke: number;
        butterfly: number;
        individualMedley: number;
        choice: number;
      };
      activityBreakdown: {
        swim: number;
        kick: number;
        pull: number;
        drill: number;
      };
    };
  } | {
    version: number;
    analysis: {
      total_meters: number;
      stroke_breakdown: Record<string, number>;
      activity_breakdown: Record<string, number>;
    };
  };
};

// Helper to convert new versioned format to old ParsedWorkout format
function normalizeJsonDescription(jsonDesc: any): { estimate: any } | null {
  if (!jsonDesc) return null;
  
  // Check if it's the new versioned format
  if ('version' in jsonDesc && 'analysis' in jsonDesc) {
    const analysis = jsonDesc.analysis;
    return {
      estimate: {
        totalDistance: analysis.total_meters,
        strokeBreakdown: {
          freestyle: analysis.stroke_breakdown?.freestyle || 0,
          backstroke: analysis.stroke_breakdown?.backstroke || 0,
          breaststroke: analysis.stroke_breakdown?.breaststroke || 0,
          butterfly: analysis.stroke_breakdown?.butterfly || 0,
          individualMedley: analysis.stroke_breakdown?.IM || analysis.stroke_breakdown?.im || analysis.stroke_breakdown?.individualMedley || 0,
          choice: analysis.stroke_breakdown?.choice || 0
        },
        activityBreakdown: {
          swim: analysis.activity_breakdown?.swim || 0,
          kick: analysis.activity_breakdown?.kick || 0,
          pull: analysis.activity_breakdown?.pull || 0,
          drill: analysis.activity_breakdown?.drill || 0
        }
      }
    };
  }
  
  // Already in old format
  if ('estimate' in jsonDesc) {
    return jsonDesc;
  }
  
  return null;
}

const STROKE_COLORS: Record<string, string> = {
  freestyle: '#22D3EE',
  backstroke: '#8B5CF6', 
  breaststroke: '#10B981',
  butterfly: '#F59E0B',
  individualMedley: '#EF4444',
  choice: '#6B7280'
};

const ACTIVITY_COLORS: Record<string, string> = {
  swim: '#22D3EE',
  kick: '#EF4444',
  pull: '#10B981', 
  drill: '#F59E0B'
};

type WorkoutMiniChartProps = {
  workoutId: string;
  showLegend?: boolean;
};

export default function WorkoutMiniChart({ 
  workoutId,
  showLegend = true
}: WorkoutMiniChartProps) {
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    async function fetchWorkout() {
      try {
        setLoading(true);
        const data = await getWorkoutTemplate(workoutId);
        setWorkout(data);
        // Trigger fade-in animation after data loads
        setTimeout(() => setIsVisible(true), 50);
      } catch (err) {
        console.error('Error fetching workout:', err);
        setError('Failed to load workout data');
      } finally {
        setLoading(false);
      }
    }

    fetchWorkout();
  }, [workoutId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary">
        <Loader2 size={12} className="animate-spin" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (error || !workout?.json_description) {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <BarChart3 size={12} />
        <span className="text-xs">No breakdown data</span>
      </div>
    );
  }

  const normalized = normalizeJsonDescription(workout.json_description);
  if (!normalized?.estimate) {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <BarChart3 size={12} />
        <span className="text-xs">No breakdown data</span>
      </div>
    );
  }

  const { strokeBreakdown, activityBreakdown } = normalized.estimate;
  
  // Check if we have any data to show
  const hasStrokeData = Object.values(strokeBreakdown).some(v => (v as number) > 0);
  const hasActivityData = Object.values(activityBreakdown).some(v => (v as number) > 0);
  
  if (!hasStrokeData && !hasActivityData) {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <BarChart3 size={12} />
        <span className="text-xs">No data</span>
      </div>
    );
  }

  const strokeSegments = Object.entries(strokeBreakdown)
    .filter(([_, value]) => (value as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([key, value]) => ({
      label: key === 'individualMedley' ? 'IM' : key.charAt(0).toUpperCase() + key.slice(1),
      value: value as number,
      color: STROKE_COLORS[key] || '#6B7280',
      percentage: Math.round(((value as number) / normalized.estimate.totalDistance) * 100)
    }));

  const activitySegments = Object.entries(activityBreakdown)
    .filter(([_, value]) => (value as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([key, value]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: value as number,
      color: ACTIVITY_COLORS[key] || '#6B7280',
      percentage: Math.round(((value as number) / normalized.estimate.totalDistance) * 100)
    }));

  return (
    <div className={`transition-all duration-500 ease-out ${
      isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'
    }`}>
      {/* Total Distance Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <span className="text-xs font-semibold text-text-primary">
          {normalized.estimate.totalDistance.toLocaleString()}m
        </span>
        <span className="text-xs text-text-secondary">Total Distance</span>
      </div>
      
      <div className="space-y-4">
        {/* Stroke Breakdown */}
        {strokeSegments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Strokes</span>
              <BarChart3 size={12} className="text-text-muted" />
            </div>
            
            {/* Stacked Bar */}
            <MiniStackedBar 
              segments={strokeSegments.map(s => ({
                label: s.label,
                value: s.value,
                color: s.color
              }))}
              height={16}
              className="min-w-full shadow-sm"
            />
            
            {/* Top 3 Stroke Pills */}
            {showLegend && (
              <div className="flex flex-wrap gap-1.5 min-w-[280px]">
                {strokeSegments.slice(0, 3).map((segment) => (
                  <div 
                    key={segment.label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background-tertiary/50 border border-border"
                  >
                    <div 
                      className="w-2 h-2 rounded-full shadow-sm" 
                      style={{ 
                        backgroundColor: segment.color,
                        boxShadow: `0 0 0 2px ${segment.color}20`
                      }}
                    />
                    <span className="text-xs font-medium text-text-primary">{segment.label}</span>
                    <span className="text-xs font-bold text-text-secondary">{segment.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Activity Breakdown */}
        {activitySegments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Activities</span>
              <BarChart3 size={12} className="text-text-muted" />
            </div>
            
            {/* Stacked Bar */}
            <MiniStackedBar 
              segments={activitySegments.map(s => ({
                label: s.label,
                value: s.value,
                color: s.color
              }))}
              height={16}
              className="min-w-full shadow-sm"
            />
            
            {/* Top 3 Activity Pills */}
            {showLegend && (
              <div className="flex flex-wrap gap-1.5 min-w-[280px]">
                {activitySegments.slice(0, 3).map((segment) => (
                  <div 
                    key={segment.label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background-tertiary/50 border border-border"
                  >
                    <div 
                      className="w-2 h-2 rounded-full shadow-sm" 
                      style={{ 
                        backgroundColor: segment.color,
                        boxShadow: `0 0 0 2px ${segment.color}20`
                      }}
                    />
                    <span className="text-xs font-medium text-text-primary">{segment.label}</span>
                    <span className="text-xs font-bold text-text-secondary">{segment.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}