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
        <div className="px-3 py-1.5 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50">
          <span className="text-xs text-slate-400">Loading...</span>
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
    
    return (
      <div className="inline-flex flex-col gap-1 px-2.5 py-1.5 rounded-lg bg-linear-to-br from-emerald-500/20 to-emerald-500/5 backdrop-blur-sm border border-emerald-500/30 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3 w-3 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
            {comparison.achievedLevel}
          </span>
        </div>
        {achievedStandard && (
          <div className="flex flex-col text-[10px] leading-tight">
            <span className="text-emerald-300 font-semibold">{formatTimeDelta(achievedStandard.gapSeconds)}</span>
            <span className="text-emerald-200/80 font-medium">{formatPercentageDelta(achievedStandard.gapPercentage)}</span>
          </div>
        )}
      </div>
    );
  }

  // If swimmer has a next level to achieve
  if (comparison.nextLevel && comparison.gapSeconds !== undefined && comparison.gapPercentage !== undefined) {
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
    
    const deltaColor = isVeryClose
      ? 'text-emerald-300'
      : isClose 
      ? 'text-amber-300' 
      : isModerate 
      ? 'text-orange-300' 
      : isFar 
      ? 'text-red-300'
      : 'text-rose-300';
    
    const deltaPercentColor = isVeryClose
      ? 'text-emerald-200/80'
      : isClose 
      ? 'text-amber-200/80' 
      : isModerate 
      ? 'text-orange-200/80' 
      : isFar 
      ? 'text-red-200/80'
      : 'text-rose-200/80';
    
    return (
      <div className={`inline-flex flex-col gap-1 px-2.5 py-1.5 rounded-lg bg-linear-to-br ${bgGradient} backdrop-blur-sm border ${borderColor} shadow-sm hover:shadow-md transition-all`}>
        <div className="flex items-center gap-1.5">
          <TrendingUp className={`h-3 w-3 ${iconColor}`} />
          <span className={`text-xs font-bold ${textColor} uppercase tracking-wide`}>
            {comparison.nextLevel}
          </span>
        </div>
        <div className="flex flex-col text-[10px] leading-tight">
          <span className={`${deltaColor} font-semibold`}>{formatTimeDelta(comparison.gapSeconds)}</span>
          <span className={`${deltaPercentColor} font-medium`}>{formatPercentageDelta(comparison.gapPercentage)}</span>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 text-xs text-slate-500">
      <Target className="h-3 w-3" />
      <span>No match</span>
    </div>
  );
}
