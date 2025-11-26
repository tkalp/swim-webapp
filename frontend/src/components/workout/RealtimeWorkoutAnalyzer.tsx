import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Target, Clock, Waves, ChevronDown, ChevronUp, Activity, Flame, Edit2, Wrench } from 'lucide-react';
import { analyzeWorkout, type WorkoutAnalysis } from '@/services/workoutAnalysisService';
import { useAnimatedValues } from '@/hooks/useAnimatedValue';

interface RealtimeWorkoutAnalyzerProps {
  workoutText: string;
  className?: string;
  onAnalysisUpdate?: (jsonDescription: string | null) => void; // Callback for JSON updates
  onEditMetric?: (metric: 'distance' | 'duration' | 'calories', currentValue: number) => void; // Callback for editing metrics
}

// Vibrant gradient color schemes with glow effects
const STROKE_COLORS = {
  freestyle: { 
    bg: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
    solid: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.4)'
  },
  backstroke: { 
    bg: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)',
    solid: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.4)'
  },
  breaststroke: { 
    bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    solid: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)'
  },
  butterfly: { 
    bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    solid: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)'
  },
  im: { 
    bg: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
    solid: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.4)'
  },
  choice: { 
    bg: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)',
    solid: '#6b7280',
    glow: 'rgba(107, 114, 128, 0.4)'
  }
};

const ACTIVITY_COLORS = {
  swim: { 
    bg: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
    solid: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.4)'
  },
  kick: { 
    bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    solid: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)'
  },
  pull: { 
    bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    solid: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)'
  },
  drill: { 
    bg: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)',
    solid: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.4)'
  }
};

export default function RealtimeWorkoutAnalyzer({ workoutText, className = '', onAnalysisUpdate, onEditMetric }: RealtimeWorkoutAnalyzerProps) {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Collapse by default on mobile (screens < 640px for phones)
  const [isCollapsed, setIsCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 640);

  // Debounced text state to reduce jitter
  const [debouncedText, setDebouncedText] = useState(workoutText);

  // Debounce workout text changes - longer delay to reduce jitter
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedText(workoutText);
    }, 1200); // Increased debounce to reduce jitter and API calls

    return () => clearTimeout(timeoutId);
  }, [workoutText]);

  // Generate JSON description from analysis
  const generateJsonDescription = useCallback((analysis: WorkoutAnalysis | null): string | null => {
    if (!analysis) return null;
    if (analysis.total_sets === 0) return null;
    // Convert the analysis to ParsedWorkout format that matches the database structure
    const jsonDescription = {
      blocks: [{
        name: "Main Workout",
        sets: analysis.sets_details.map(set => ({
          reps: set.reps,
          distance: set.distance,
          stroke: set.stroke,
          activity: set.activity,
          interval: set.interval_time || null,
          restTime: null,
          setType: set.energy_zone === 'warmup' ? 'warmup' : 
                   set.energy_zone === 'cooldown' ? 'cooldown' : 'main',
          equipment: [],
          technicalFocus: [],
          intensity: set.energy_zone === 'easy' ? 'easy' : 
                    set.energy_zone === 'moderate' ? 'moderate' : 
                    set.energy_zone === 'hard' ? 'hard' : 'moderate',
          originalText: `${set.reps}x${set.distance} ${set.stroke} ${set.activity}`,
          estimatedTotalDistance: set.total_distance,
          estimatedTotalMinutes: null,
          notes: null,
          conditionalSegments: set.breakdown_components ? 
            [{
              condition: { type: 'all', description: 'all reps' },
              segments: set.breakdown_components.map(comp => ({
                distance: comp.distance,
                stroke: comp.stroke,
                activity: comp.activity,
                description: comp.description,
                interval: null,
                drillName: null
              }))
            }] : [],
          strokeBreakdown: {
            freestyle: set.stroke === 'freestyle' ? set.total_distance : 0,
            backstroke: set.stroke === 'backstroke' ? set.total_distance : 0,
            breaststroke: set.stroke === 'breaststroke' ? set.total_distance : 0,
            butterfly: set.stroke === 'butterfly' ? set.total_distance : 0,
            individualMedley: (set.stroke === 'IM' || set.stroke === 'im' || set.stroke === 'individualMedley') ? set.total_distance : 0,
            choice: set.stroke === 'choice' ? set.total_distance : 0
          },
          activityBreakdown: {
            swim: set.activity === 'swim' ? set.total_distance : 0,
            kick: set.activity === 'kick' ? set.total_distance : 0,
            pull: set.activity === 'pull' ? set.total_distance : 0,
            drill: set.activity === 'drill' ? set.total_distance : 0
          },
          isRest: false,
          isAuxilary: false,
          drillName: null
        })),
        notes: null,
        estimatedMinutes: analysis.estimated_duration_minutes,
        estimatedDistance: analysis.total_meters,
        strokeBreakdown: {
          freestyle: analysis.stroke_breakdown.freestyle || 0,
          backstroke: analysis.stroke_breakdown.backstroke || 0,
          breaststroke: analysis.stroke_breakdown.breaststroke || 0,
          butterfly: analysis.stroke_breakdown.butterfly || 0,
          individualMedley: analysis.stroke_breakdown.IM || analysis.stroke_breakdown.im || analysis.stroke_breakdown.individualMedley || 0,
          choice: analysis.stroke_breakdown.choice || 0
        },
        activityBreakdown: {
          swim: analysis.activity_breakdown.swim || 0,
          kick: analysis.activity_breakdown.kick || 0,
          pull: analysis.activity_breakdown.pull || 0,
          drill: analysis.activity_breakdown.drill || 0
        }
      }],
      estimate: {
        totalMinutes: analysis.estimated_duration_minutes,
        totalDistance: analysis.total_meters,
        strokeBreakdown: {
          freestyle: analysis.stroke_breakdown.freestyle || 0,
          backstroke: analysis.stroke_breakdown.backstroke || 0,
          breaststroke: analysis.stroke_breakdown.breaststroke || 0,
          butterfly: analysis.stroke_breakdown.butterfly || 0,
          individualMedley: analysis.stroke_breakdown.IM || analysis.stroke_breakdown.im || analysis.stroke_breakdown.individualMedley || 0,
          choice: analysis.stroke_breakdown.choice || 0
        },
        activityBreakdown: {
          swim: analysis.activity_breakdown.swim || 0,
          kick: analysis.activity_breakdown.kick || 0,
          pull: analysis.activity_breakdown.pull || 0,
          drill: analysis.activity_breakdown.drill || 0
        },
        estimatedCalories: Math.round(analysis.estimated_duration_minutes * 12), // Rough estimate
        difficulty: analysis.classification === 'Easy' ? 'easy' :
                   analysis.classification === 'Moderate' ? 'moderate' :
                   analysis.classification === 'Hard' ? 'hard' : 'moderate',
        intensityScore: Math.round((analysis.total_meters / analysis.estimated_duration_minutes) / 10) // Rough intensity
      },
      confidence: "medium" as const
    };

    return JSON.stringify(jsonDescription, null, 2);
  }, []);

  // Update JSON description whenever analysis changes
  useEffect(() => {
    if (onAnalysisUpdate) {
      const jsonDesc = generateJsonDescription(analysis);
      onAnalysisUpdate(jsonDesc);
    }
  }, [analysis, generateJsonDescription]); // Removed onAnalysisUpdate from dependencies

  // Memoize the analysis function to prevent unnecessary re-renders
  const analyzeWorkoutText = useCallback(async (text: string) => {
    if (!text.trim()) {
      setAnalysis(null);
      setError(null);
      return;
    }

    try {
      setError(null);
      const result = await analyzeWorkout(text);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setAnalysis(null);
    }
  }, []);

  useEffect(() => {
    // Only analyze when debouncedText changes
    if (debouncedText.trim()) {
      analyzeWorkoutText(debouncedText);
    } else {
      setAnalysis(null);
      setError(null);
    }
  }, [debouncedText, analyzeWorkoutText]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Memoize chart data preparation to reduce recalculations
  const strokeChartData = useMemo(() => {
    if (!analysis) return [];
    
    const defaultColor = { bg: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)', solid: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)' };
    
    return Object.entries(analysis.stroke_breakdown)
      .filter(([stroke, meters]) => stroke !== 'total' && meters > 0)
      .map(([stroke, meters]) => ({
        label: stroke == "im" ? "IM" : stroke.charAt(0).toUpperCase() + stroke.slice(1),
        value: meters,
        percentage: Math.round((analysis.stroke_percentages[stroke] || 0) * 100) / 100, // Round to 2 decimal places
        colors: STROKE_COLORS[stroke as keyof typeof STROKE_COLORS] || defaultColor
      }))
      .sort((a, b) => b.value - a.value);
  }, [analysis]);

  const activityChartData = useMemo(() => {
    if (!analysis) return [];
    
    const defaultColor = { bg: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)', solid: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)' };
    
    return Object.entries(analysis.activity_breakdown)
      .filter(([activity, meters]) => activity !== 'total' && meters > 0)
      .map(([activity, meters]) => ({
        label: activity.charAt(0).toUpperCase() + activity.slice(1),
        value: meters,
        percentage: Math.round((analysis.activity_percentages[activity] || 0) * 100) / 100, // Round to 2 decimal places
        colors: ACTIVITY_COLORS[activity as keyof typeof ACTIVITY_COLORS] || defaultColor
      }))
      .sort((a, b) => b.value - a.value);
  }, [analysis]);

  // Animated values for smooth transitions - with shorter durations and proper memoization
  const strokeAnimationData = useMemo(() => 
    strokeChartData.reduce((acc, item) => {
      acc[`stroke_${item.label.toLowerCase()}`] = item.percentage;
      return acc;
    }, {} as Record<string, number>),
    [strokeChartData]
  );

  const activityAnimationData = useMemo(() =>
    activityChartData.reduce((acc, item) => {
      acc[`activity_${item.label.toLowerCase()}`] = item.percentage;
      return acc;
    }, {} as Record<string, number>),
    [activityChartData]
  );

  const metricsData = useMemo(() => ({
    totalMeters: analysis?.total_meters || 0,
    totalSets: analysis?.total_sets || 0,
    estimatedDuration: analysis?.estimated_duration_minutes || 0,
    swimTime: analysis?.swim_time_minutes || 0,
    calories: analysis?.estimated_calories || 0
  }), [analysis]);

  const animatedMetrics = useAnimatedValues(metricsData, { duration: 300 }); // Fast for metrics
  const animatedStrokeValues = useAnimatedValues(strokeAnimationData, { duration: 600 }); // Medium for charts
  const animatedActivityValues = useAnimatedValues(activityAnimationData, { duration: 600 });

  if (!workoutText.trim()) {
    return (
      <div className={`${className} bg-slate-900/90 backdrop-blur-xl rounded-lg md:rounded-xl border border-slate-800/60 shadow-xl overflow-hidden`}>
        <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 border-b border-slate-700/50 px-3 md:px-4 py-3 md:py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
              <BarChart3 size={16} className="text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm md:text-base font-bold text-slate-100 tracking-tight">Workout Analysis</h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-medium mt-0.5">Real-time metrics & breakdown</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <BarChart3 size={40} className="text-slate-500 mb-3" />
          <p className="text-slate-400 text-sm">Start typing your workout to see real-time analysis</p>
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className={`${className} bg-slate-900/90 backdrop-blur-xl rounded-lg md:rounded-xl border border-slate-800/60 shadow-xl overflow-hidden`}>
        <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 border-b border-slate-700/50 px-3 md:px-4 py-3 md:py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
              <BarChart3 size={16} className="text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm md:text-base font-bold text-slate-100 tracking-tight">Workout Analysis</h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-medium mt-0.5">Real-time metrics & breakdown</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <Target className="w-10 h-10 text-orange-500 mb-3" />
          <p className="text-orange-400 font-medium mb-1 text-sm">Unable to parse workout</p>
          <p className="text-slate-500 text-xs">Check your workout format</p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className={`${className} bg-slate-900/90 backdrop-blur-xl rounded-lg md:rounded-xl border border-slate-800/60 shadow-xl overflow-hidden`}>
      {/* Collapsible Header */}
      <div 
        className="bg-linear-to-br from-slate-800/40 to-slate-900/40 border-b border-slate-700/50 px-2.5 py-2.5 sm:px-3 sm:py-3 md:px-4 md:py-3.5 cursor-pointer hover:from-slate-800/50 hover:to-slate-900/50 transition-colors touch-manipulation active:scale-[0.99]"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
            <BarChart3 size={14} className="text-cyan-400 sm:w-4 sm:h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xs sm:text-sm md:text-base font-bold text-slate-100 tracking-tight">Workout Analysis</h2>
            {analysis.classification && (
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 truncate">
                {analysis.classification} • {Math.round(animatedMetrics.totalMeters)}m • {formatTime(animatedMetrics.estimatedDuration)}
              </p>
            )}
          </div>
          <div className="shrink-0 text-slate-400">
            {isCollapsed ? <ChevronDown size={16} className="sm:w-[18px] sm:h-[18px]" /> : <ChevronUp size={16} className="sm:w-[18px] sm:h-[18px]" />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-2 sm:p-2.5 md:p-3 lg:p-4 space-y-2 sm:space-y-2.5 md:space-y-3 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Key Metrics Cards - Clickable to Edit - Responsive Grid */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <div 
              className="bg-slate-800/50 rounded-lg p-2 sm:p-2.5 md:p-3 transition-colors duration-200 hover:bg-slate-800/70 cursor-pointer group relative touch-manipulation will-change-auto active:scale-95"
              onClick={() => onEditMetric?.('distance', Math.round(animatedMetrics.totalMeters))}
              title="Click to edit distance"
            >
              <div className="flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                <Waves className="text-cyan-400" size={11} />
                <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-cyan-400 truncate">Distance</span>
                <Edit2 size={8} className="ml-auto text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
              </div>
              <p className="text-base sm:text-lg md:text-xl font-bold text-slate-100 tabular-nums truncate">{Math.round(animatedMetrics.totalMeters)}m</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">{Math.round(animatedMetrics.totalSets)} sets</p>
            </div>
            
            <div 
              className="bg-slate-800/50 rounded-lg p-2 sm:p-2.5 md:p-3 transition-colors duration-200 hover:bg-slate-800/70 cursor-pointer group relative touch-manipulation will-change-auto active:scale-95"
              onClick={() => onEditMetric?.('duration', Math.round(animatedMetrics.estimatedDuration))}
              title="Click to edit duration"
            >
              <div className="flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                <Clock className="text-green-400" size={11} />
                <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-green-400 truncate">Duration</span>
                <Edit2 size={8} className="ml-auto text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
              </div>
              <p className="text-base sm:text-lg md:text-xl font-bold text-slate-100 tabular-nums truncate">{formatTime(animatedMetrics.estimatedDuration)}</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">{formatTime(animatedMetrics.swimTime)} swim</p>
            </div>
          </div>

          {/* Stroke Distribution - Enhanced with Gradients */}
          {strokeChartData.length > 0 && (
            <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 rounded-lg p-2.5 sm:p-3 md:p-3.5 border border-slate-700/50">
              <h3 className="text-xs sm:text-sm md:text-base font-semibold text-slate-200 mb-2 sm:mb-2.5 md:mb-3 flex items-center gap-1.5 sm:gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                  <Waves size={11} className="text-cyan-400 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5" />
                </div>
                Stroke Distribution
              </h3>
              <div className="space-y-2 sm:space-y-2.5">
                {strokeChartData.map((item, index) => {
                  const animatedPercentage = animatedStrokeValues[`stroke_${item.label.toLowerCase()}`] || item.percentage;
                  return (
                    <div key={`${item.label}-${index}`} className="group">
                      <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <div
                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 transition-all duration-300 group-hover:scale-110"
                            style={{ 
                              background: item.colors.bg,
                              boxShadow: `0 0 8px ${item.colors.glow}`
                            }}
                          />
                          <span className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-200 truncate">{item.label}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-100 ml-2 tabular-nums">
                          {animatedPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-700/50 rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out relative"
                          style={{
                            background: item.colors.bg,
                            width: `${Math.min(100, Math.max(0, animatedPercentage))}%`,
                            boxShadow: `0 0 12px ${item.colors.glow}`
                          }}
                        >
                          <div className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent opacity-50" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Distribution - Enhanced with Gradients */}
          {activityChartData.length > 0 && (
            <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 rounded-lg p-2.5 sm:p-3 md:p-3.5 border border-slate-700/50">
              <h3 className="text-xs sm:text-sm md:text-base font-semibold text-slate-200 mb-2 sm:mb-2.5 md:mb-3 flex items-center gap-1.5 sm:gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg bg-linear-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Activity size={11} className="text-purple-400 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5" />
                </div>
                Activity Breakdown
              </h3>
              <div className="space-y-2 sm:space-y-2.5">
                {activityChartData.map((item, index) => {
                  const animatedPercentage = animatedActivityValues[`activity_${item.label.toLowerCase()}`] || item.percentage;
                  return (
                    <div key={`${item.label}-${index}`} className="group">
                      <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <div
                            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 transition-all duration-300 group-hover:scale-110"
                            style={{ 
                              background: item.colors.bg,
                              boxShadow: `0 0 8px ${item.colors.glow}`
                            }}
                          />
                          <span className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-200 truncate">{item.label}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-100 ml-2 tabular-nums">
                          {animatedPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-700/50 rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out relative will-change-transform"
                          style={{
                            background: item.colors.bg,
                            transform: `scaleX(${Math.min(1, Math.max(0, animatedPercentage / 100))})`,
                            transformOrigin: 'left',
                            width: '100%',
                            boxShadow: `0 0 12px ${item.colors.glow}`
                          }}
                        >
                          <div className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent opacity-50" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Equipment & Energy Zones - Compact Pills Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Equipment Pills */}
            {analysis.equipment_breakdown && Object.keys(analysis.equipment_breakdown).length > 0 && (
              <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 rounded-lg p-2 sm:p-2.5 border border-slate-700/50 overflow-hidden">
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                  <div className="w-4 h-4 rounded bg-linear-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
                    <Wrench size={9} className="text-amber-400 sm:w-2.5 sm:h-2.5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-slate-300">Equipment</span>
                </div>
                <div className="flex flex-wrap gap-1 sm:gap-1.5 max-h-16 sm:max-h-20 overflow-y-auto custom-scrollbar">
                  {Object.entries(analysis.equipment_breakdown)
                    .filter(([_, meters]) => meters > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([equipment, meters]) => (
                      <span
                        key={equipment}
                        className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-500/10 border border-amber-500/30 rounded text-[9px] sm:text-[10px] md:text-xs font-medium text-amber-300 shrink-0"
                        title={`${meters}m`}
                      >
                        {equipment.charAt(0).toUpperCase() + equipment.slice(1)}
                        <span className="text-amber-400/70 text-[8px] sm:text-[9px] tabular-nums">{meters}m</span>
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Energy Zones Pills */}
            {analysis.energy_zone_breakdown && Object.keys(analysis.energy_zone_breakdown).length > 0 && (
              <div className="bg-linear-to-br from-slate-800/40 to-slate-900/40 rounded-lg p-2 sm:p-2.5 border border-slate-700/50 overflow-hidden">
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                  <div className="w-4 h-4 rounded bg-linear-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
                    <Activity size={9} className="text-red-400 sm:w-2.5 sm:h-2.5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-slate-300">Zones</span>
                </div>
                <div className="flex flex-wrap gap-1 sm:gap-1.5 max-h-16 sm:max-h-20 overflow-y-auto custom-scrollbar">
                  {Object.entries(analysis.energy_zone_breakdown)
                    .filter(([zone, meters]) => zone !== 'total' && meters > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([zone, meters]) => {
                      const zoneColors: Record<string, string> = {
                        'en1': 'bg-green-500/10 border-green-500/30 text-green-300',
                        'en2': 'bg-blue-500/10 border-blue-500/30 text-blue-300',
                        'en3': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
                        'sp1': 'bg-orange-500/10 border-orange-500/30 text-orange-300',
                        'sp2': 'bg-red-500/10 border-red-500/30 text-red-300',
                        'race': 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                      };
                      const colorClass = zoneColors[zone.toLowerCase()] || 'bg-slate-500/10 border-slate-500/30 text-slate-300';
                      const percentage = analysis.energy_zone_percentages?.[zone] 
                        ? Math.round(analysis.energy_zone_percentages[zone] * 100) / 100 
                        : 0;
                      
                      return (
                        <span
                          key={zone}
                          className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 border rounded text-[9px] sm:text-[10px] md:text-xs font-medium ${colorClass} shrink-0`}
                          title={`${meters}m (${percentage}%)`}
                        >
                          {zone.toUpperCase()}
                          <span className="opacity-70 text-[8px] sm:text-[9px] tabular-nums">{percentage}%</span>
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}