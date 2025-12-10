import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { getStandardsForEvent, calculateStandardComparison, formatTimeDelta, formatPercentageDelta, mapGenderToStandards, normalizePoolType } from '@/services/swimmerStandards';
import { TimeStandard } from '@/types/standards';

interface StandardsCellProps {
  standardsSetId: string | null;
  distance: number;
  stroke: string;
  timeSeconds: number;
  resultUnits: string;
  swimmerAge: number;
  swimmerSex?: string | null;
}

export function StandardsCell({
  standardsSetId,
  distance,
  stroke,
  timeSeconds,
  resultUnits,
  swimmerAge,
  swimmerSex
}: StandardsCellProps) {
  const [standards, setStandards] = useState<TimeStandard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!standardsSetId) {
      setStandards([]);
      return;
    }

    loadStandards();
  }, [standardsSetId, distance, stroke, swimmerAge, swimmerSex, resultUnits]);

  const loadStandards = async () => {
    if (!standardsSetId) return;

    try {
      setIsLoading(true);
      const gender = mapGenderToStandards(swimmerSex);
      const poolType = normalizePoolType(resultUnits);
      
      // Only fetch standards for SCM/LCM (not SCY)
      if (poolType !== 'SCM' && poolType !== 'LCM') {
        setStandards([]);
        return;
      }

      const data = await getStandardsForEvent(
        standardsSetId,
        distance,
        stroke,
        swimmerAge,
        gender,
        poolType
      );
      setStandards(data);
    } catch (error) {
      console.error('Error loading standards:', error);
      setStandards([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show anything if no standards set selected
  if (!standardsSetId) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="px-1.5 py-0.5 rounded bg-slate-800/30 border border-slate-700/50">
          <span className="text-[10px] text-slate-400">...</span>
        </div>
      </div>
    );
  }

  // No standards found
  if (standards.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-500">
        —
      </div>
    );
  }

  const poolType = normalizePoolType(resultUnits);
  const comparison = calculateStandardComparison(timeSeconds, standards, poolType);

  // If swimmer achieved a level
  if (comparison.achievedLevel) {
    const achievedStandard = comparison.allLevels.find(l => l.level === comparison.achievedLevel);
    
    if (!achievedStandard) return null;
    
    return (
      <div className="group relative">
        <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-linear-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30">
          <TrendingDown className="h-2 w-2 text-emerald-400 shrink-0" />
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
            {comparison.achievedLevel}
          </span>
        </div>
        
        {/* Tooltip with standard time */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1.5 bg-slate-900/95 backdrop-blur-sm border border-emerald-500/30 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
          <div className="text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-emerald-400 font-semibold">{comparison.achievedLevel} Standard:</span>
              <span className="text-emerald-300 font-mono">{achievedStandard.time}</span>
            </div>
          </div>
          {/* Arrow pointing down */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-emerald-500/30"></div>
        </div>
      </div>
    );
  }

  // If swimmer has a next level to achieve
  if (comparison.nextLevel && comparison.gapSeconds !== undefined && comparison.gapPercentage !== undefined && comparison.nextLevelTime && comparison.nextLevelSeconds) {
    const absGap = Math.abs(comparison.gapPercentage);
    const isVeryClose = absGap < 2;
    const isClose = absGap < 5;
    const isModerate = absGap < 10;
    const isFar = absGap < 15;
    const isVeryFar = absGap >= 15;
    
    // Glassomorphic colors based on distance to target
    // <2%: emerald (very close), 2-5%: amber (close), 5-10%: orange (moderate), 10-15%: red-orange (far), 15%+: rose (very far)
    const bgGradient = isVeryClose
      ? 'from-emerald-500/20 to-emerald-500/5'
      : isClose 
      ? 'from-amber-500/20 to-amber-500/5' 
      : isModerate 
      ? 'from-orange-500/20 to-orange-500/5' 
      : isFar 
      ? 'from-red-500/20 to-red-500/5'
      : 'from-rose-500/20 to-rose-500/5';
    
    const borderColor = isVeryClose
      ? 'border-emerald-500/30 hover:border-emerald-500/50'
      : isClose 
      ? 'border-amber-500/30 hover:border-amber-500/50' 
      : isModerate 
      ? 'border-orange-500/30 hover:border-orange-500/50' 
      : isFar 
      ? 'border-red-500/30 hover:border-red-500/50'
      : 'border-rose-500/30 hover:border-rose-500/50';
    
    const textColor = isVeryClose
      ? 'text-emerald-400'
      : isClose 
      ? 'text-amber-400' 
      : isModerate 
      ? 'text-orange-400' 
      : isFar 
      ? 'text-red-400'
      : 'text-rose-400';
    
    const iconColor = isVeryClose
      ? 'text-emerald-400'
      : isClose 
      ? 'text-amber-400' 
      : isModerate 
      ? 'text-orange-400' 
      : isFar 
      ? 'text-red-400'
      : 'text-rose-400';
    
    const tooltipBorderColor = isVeryClose
      ? 'border-emerald-500/30'
      : isClose 
      ? 'border-amber-500/30' 
      : isModerate 
      ? 'border-orange-500/30' 
      : isFar 
      ? 'border-red-500/30'
      : 'border-rose-500/30';
    
    const tooltipAccentColor = isVeryClose
      ? 'text-emerald-400'
      : isClose 
      ? 'text-amber-400' 
      : isModerate 
      ? 'text-orange-400' 
      : isFar 
      ? 'text-red-400'
      : 'text-rose-400';
    
    return (
      <div className="group relative">
        <div className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-linear-to-br ${bgGradient} border ${borderColor}`}>
          <TrendingUp className={`h-2 w-2 ${iconColor} shrink-0`} />
          <span className={`text-[9px] font-bold ${textColor} uppercase tracking-wide`}>
            {comparison.nextLevel}
          </span>
        </div>
        
        {/* Tooltip with standard time and gap */}
        <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1.5 bg-slate-900/95 backdrop-blur-sm border ${tooltipBorderColor} rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap`}>
          <div className="text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-3">
              <span className={`${tooltipAccentColor} font-semibold`}>{comparison.nextLevel} Standard:</span>
              <span className={`${tooltipAccentColor.replace('400', '300')} font-mono`}>{comparison.nextLevelTime}</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-slate-700/50">
              <span className="text-slate-400">Gap to achieve:</span>
              <span className={`${tooltipAccentColor.replace('400', '300')} font-mono`}>
                {formatTimeDelta(-comparison.gapSeconds)}
              </span>
            </div>
          </div>
          {/* Arrow pointing down */}
          <div className={`absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent ${tooltipBorderColor.replace('border-', 'border-t-')}`}></div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-800/30 border border-slate-700/50 text-[9px] text-slate-500">
      <Target className="h-2 w-2 shrink-0" />
      <span>—</span>
    </div>
  );
}
