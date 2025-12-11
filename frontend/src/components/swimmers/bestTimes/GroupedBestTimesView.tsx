// components/swimmer/bestTimes/GroupedBestTimesView.tsx
import { useMemo, useState } from "react";
import type { BestTimeResult, SwimmerPredictionsResponse } from '@/services/workoutResultService';
import { formatTime } from '@/utils/timeUtils';
import { Clock, Activity, TrendingDown, TrendingUp, Eye, EyeOff, Info, Sparkles, Users, Award, HelpCircle } from "lucide-react";
import { StandardsCell } from '@/components/swimmers/timeStandards';
import { calculateSwimmerAge } from '@/services/swimmerStandards';

const STROKE_ORDER = ["free", "back", "breast", "fly", "im"] as const;
const STROKE_LABEL: Record<string, string> = {
  free: "Freestyle",
  back: "Backstroke",
  breast: "Breaststroke",
  fly: "Butterfly",
  im: "Individual Medley",
};

type StrokeGroup = {
  stroke: string;
  label: string;
  items: BestTimeResult[];
};

// Squad Rank Badge Component
function SquadRankBadge({ rank, total, isLeader }: { rank: number; total: number; isLeader: boolean }) {
  // Safety check for invalid data
  if (rank < 1 || rank > total || total < 2) return null;
  
  // Calculate percentile (handle edge case where total = 1)
  const percentile = total > 1 ? Math.round((1 - (rank - 1) / (total - 1)) * 100) : 100;
  const badgeColor = percentile >= 80 
    ? 'from-purple-500/15 to-purple-500/5 border-purple-500/30 text-purple-400'
    : percentile >= 60
    ? 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/30 text-cyan-400'
    : percentile >= 40
    ? 'from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-400'
    : 'from-slate-500/15 to-slate-500/5 border-slate-500/30 text-slate-400';

  return (
    <div className="group/squad relative inline-block">
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-linear-to-r ${badgeColor} border rounded text-xs font-semibold cursor-help`}>
        {isLeader && <Award size={10} className="shrink-0" />}
        <Users size={9} className="shrink-0" />
        <span>#{rank}</span>
      </div>
      
      {/* Tooltip */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-40 p-2 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-lg shadow-xl opacity-0 invisible group-hover/squad:opacity-100 group-hover/squad:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="absolute top-full left-1/2 -translate-x-1/2">
          <div className="border-4 border-transparent border-t-cyan-500/30"></div>
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Squad Rank:</span>
            <span className="text-cyan-400 font-bold">#{rank}/{total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Percentile:</span>
            <span className="text-cyan-400 font-bold">{percentile}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Prediction Badge Component
function PredictionBadge({ 
  prediction, 
  showTooltipBelow,
  compact = false
}: { 
  prediction: any; 
  showTooltipBelow: boolean;
  compact?: boolean;
}) {
  return (
    <div className="group/pred relative inline-block">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-linear-to-br from-purple-500/15 via-purple-500/8 to-transparent border border-purple-500/30 rounded-md hover:border-purple-400/50 hover:shadow-md hover:shadow-purple-500/10 transition-all cursor-help">
        <Sparkles size={11} className="text-purple-400 group-hover/pred:text-purple-300 transition-colors shrink-0" />
        <span className="text-xs font-bold text-purple-300 group-hover/pred:text-purple-200 font-mono tracking-tight transition-colors">
          {formatTime(prediction.predicted_time)}
        </span>
        <Info size={9} className="text-purple-400/60 group-hover/pred:text-purple-400 transition-colors shrink-0" />
      </div>
      
      {/* Tooltip */}
      <div className={`absolute left-1/2 -translate-x-1/2 ${showTooltipBelow ? 'top-full mt-2' : 'bottom-full mb-2'} w-72 p-4 bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-500/20 opacity-0 invisible group-hover/pred:opacity-100 group-hover/pred:visible transition-all duration-200 z-50 pointer-events-none`}>
        <div className={`absolute ${showTooltipBelow ? 'bottom-full' : 'top-full'} left-1/2 -translate-x-1/2`}>
          <div className={`border-8 border-transparent ${showTooltipBelow ? 'border-b-purple-500/30' : 'border-t-purple-500/30'}`}></div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
            <Sparkles size={16} className="text-purple-400" />
            <h4 className="font-semibold text-purple-300">AI Prediction</h4>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              prediction.confidence_level === 'high' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : prediction.confidence_level === 'medium'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
            }`}>
              {prediction.confidence_level}
            </span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Current Best:</span>
              <span className="font-mono text-slate-200">{formatTime(prediction.current_best)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Predicted:</span>
              <span className="font-mono font-bold text-purple-400">{formatTime(prediction.predicted_time)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-700/50">
              <span className="text-slate-400">Expected Change:</span>
              <div className="flex items-center gap-1">
                {prediction.current_best > prediction.predicted_time ? (
                  <TrendingDown size={14} className="text-green-400" />
                ) : (
                  <TrendingUp size={14} className="text-red-400" />
                )}
                <span className={`font-mono font-bold ${prediction.current_best > prediction.predicted_time ? 'text-green-400' : 'text-red-400'}`}>
                  {prediction.current_best > prediction.predicted_time ? '-' : '+'}{Math.abs(prediction.current_best - prediction.predicted_time).toFixed(2)}s
                </span>
              </div>
            </div>
          </div>
          
          {prediction.factors && (
            <div className="pt-2 border-t border-purple-500/20">
              <div className="text-xs text-slate-500 mb-1.5">Based on:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {prediction.factors.attempts_analyzed && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Attempts:</span>
                    <span className="text-slate-300 font-medium">{prediction.factors.attempts_analyzed}</span>
                  </div>
                )}
                {prediction.factors.consistency !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consistency:</span>
                    <span className="text-slate-300 font-medium">{(prediction.factors.consistency * 100).toFixed(0)}%</span>
                  </div>
                )}
                {prediction.factors.improvement_rate !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trend:</span>
                    <span className={`font-medium ${prediction.factors.improvement_rate < 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {prediction.factors.improvement_rate < 0 ? '↓' : '↑'} {Math.abs(prediction.factors.improvement_rate).toFixed(3)}s
                    </span>
                  </div>
                )}
                {prediction.factors.recent_form !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recent Form:</span>
                    <span className="text-slate-300 font-medium">{(prediction.factors.recent_form * 100).toFixed(0)}%</span>
                  </div>
                )}
                {prediction.factors.training_alignment !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Training Fit:</span>
                    <span className="text-slate-300 font-medium">{(prediction.factors.training_alignment * 100).toFixed(0)}%</span>
                  </div>
                )}
                {prediction.factors.recent_training_volume_meters !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Volume (30d):</span>
                    <span className="text-slate-300 font-medium">{(prediction.factors.recent_training_volume_meters / 1000).toFixed(1)}km</span>
                  </div>
                )}
                {prediction.factors.avg_workout_effort !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Effort:</span>
                    <span className="text-slate-300 font-medium">{prediction.factors.avg_workout_effort}/10</span>
                  </div>
                )}
                {prediction.factors.attendance_rate !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Attendance:</span>
                    <span className="text-slate-300 font-medium">{prediction.factors.attendance_rate.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GroupedBestTimesView({
  bestTimes,
  sortBy = "time",
  canManageResults = true,
  onCardPress,
  onEditResult,
  selectedStandardsSetId,
  swimmerDateOfBirth,
  swimmerSex,
  hasTimeStandards = false,
  predictions,
  predictionsLoading = false,
  showPredictions = false,
  squadBenchmarks,
  swimmerId,
  showSquadRanks = false,
  onToggleSquadRanks,
  squadBenchmarksLoading = false,
  onShowPredictionsGuide,
}: {
  bestTimes: BestTimeResult[];
  sortBy?: "time" | "event" | "date";
  canManageResults?: boolean;
  onCardPress?: (item: BestTimeResult) => void;
  onEditResult?: (item: BestTimeResult) => void;
  selectedStandardsSetId?: string | null;
  swimmerDateOfBirth?: string;
  swimmerSex?: string;
  hasTimeStandards?: boolean;
  predictions?: SwimmerPredictionsResponse | null;
  predictionsLoading?: boolean;
  showPredictions?: boolean;
  squadBenchmarks?: Record<string, any[]>;
  swimmerId?: string;
  showSquadRanks?: boolean;
  onToggleSquadRanks?: () => void;
  squadBenchmarksLoading?: boolean;
  onShowPredictionsGuide?: () => void;
}) {
  const [showStandards, setShowStandards] = useState(true);
  
  const hasSquadData = squadBenchmarks && Object.keys(squadBenchmarks).length > 0;
  
  const swimmerAge = swimmerDateOfBirth ? calculateSwimmerAge(swimmerDateOfBirth) : undefined;
  const hasStandardsEnabled = hasTimeStandards && selectedStandardsSetId && swimmerAge !== undefined && swimmerSex;

  const groups = useMemo(() => {
    const map = new Map<string, BestTimeResult[]>();
    bestTimes.forEach((r) => {
      const k = (r.stroke || "free").toLowerCase();
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    STROKE_ORDER.forEach((k) => {
      const arr = map.get(k);
      if (arr) {
        if (sortBy === "event") {
          arr.sort((a, b) => a.distance - b.distance || a.timeSeconds - b.timeSeconds);
        } else if (sortBy === "date") {
          arr.sort(
            (a, b) =>
              new Date(b.performedOn ?? 0).getTime() -
              new Date(a.performedOn ?? 0).getTime()
          );
        } else {
          arr.sort((a, b) => a.timeSeconds - b.timeSeconds);
        }
      }
    });
    return STROKE_ORDER
      .filter((k) => (map.get(k)?.length ?? 0) > 0)
      .map((k) => ({ stroke: k, label: STROKE_LABEL[k], items: map.get(k)! }));
  }, [bestTimes, sortBy]);

  return (
    <TableView 
      groups={groups} 
      canManageResults={canManageResults} 
      onCardPress={onCardPress} 
      onEditResult={onEditResult}
      hasStandardsEnabled={hasStandardsEnabled as boolean}
      showStandards={showStandards}
      setShowStandards={setShowStandards}
      selectedStandardsSetId={selectedStandardsSetId}
      swimmerAge={swimmerAge}
      swimmerSex={swimmerSex}
      predictions={predictions}
      predictionsLoading={predictionsLoading}
      showPredictions={showPredictions}
      squadBenchmarks={squadBenchmarks}
      swimmerId={swimmerId}
      hasSquadData={hasSquadData}
      showSquadRanks={showSquadRanks}
      onToggleSquadRanks={onToggleSquadRanks}
      squadBenchmarksLoading={squadBenchmarksLoading}
      onShowPredictionsGuide={onShowPredictionsGuide}
    />
  );
}

function labelActivity(a?: string) {
  const v = (a ?? "").toLowerCase();
  if (v === "kick") return "Kick";
  if (v === "pull") return "Pull";
  return "Swim";
}

function getActivityStyles(activity?: string) {
  const v = (activity ?? "").toLowerCase();
  if (v === "kick") return "bg-gradient-to-br from-orange-500/20 to-orange-500/10 border border-orange-500/40 text-orange-400 font-bold";
  if (v === "pull") return "bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/40 text-green-400 font-bold";
  return "bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/40 text-cyan-400 font-bold";
}

function TableView({
  groups,
  canManageResults = true,
  onCardPress,
  onEditResult,
  hasStandardsEnabled,
  showStandards,
  setShowStandards,
  selectedStandardsSetId,
  swimmerAge,
  swimmerSex,
  predictions,
  predictionsLoading = false,
  showPredictions = false,
  squadBenchmarks,
  swimmerId,
  hasSquadData,
  showSquadRanks,
  onToggleSquadRanks,
  squadBenchmarksLoading,
  onShowPredictionsGuide,
}: {
  groups: StrokeGroup[];
  canManageResults?: boolean;
  onCardPress?: (item: BestTimeResult) => void;
  onEditResult?: (item: BestTimeResult) => void;
  hasStandardsEnabled?: boolean;
  showStandards?: boolean;
  setShowStandards?: (show: boolean) => void;
  selectedStandardsSetId?: string | null;
  swimmerAge?: number;
  swimmerSex?: string;
  predictions?: SwimmerPredictionsResponse | null;
  predictionsLoading?: boolean;
  showPredictions?: boolean;
  squadBenchmarks?: Record<string, any[]>;
  swimmerId?: string;
  hasSquadData?: boolean;
  showSquadRanks?: boolean;
  onToggleSquadRanks?: () => void;
  squadBenchmarksLoading?: boolean;
  onShowPredictionsGuide?: () => void;
}) {
  const hasScyResults = groups.some(g => g.items.some(item => item.resultUnits === 'SCY'));
  
  const groupedData = groups.map(group => {
    const eventMap = new Map<string, { distance: number; activity: string; equipment: string; items: BestTimeResult[] }>();
    
    group.items.forEach(item => {
      const key = `${item.distance}-${item.activity}-${item.equipment}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, {
          distance: item.distance,
          activity: item.activity,
          equipment: item.equipment,
          items: []
        });
      }
      eventMap.get(key)!.items.push(item);
    });
        
    return {
      ...group,
      events: Array.from(eventMap.values()).sort((a, b) => a.distance - b.distance)
    };
  });

  // Helper to find predictions
  const findPrediction = (event: any, anyItem: BestTimeResult, units: string) => {
    return predictions?.predictions.find(p => {
      const eventStr = p.event.toLowerCase();
      const isYards = units === 'scy';
      const matchDistance = isYards 
        ? eventStr.includes(`${event.distance}y`)
        : eventStr.includes(`${event.distance}m`);
      const matchStroke = eventStr.includes(anyItem.stroke.toLowerCase());
      const matchActivity = event.activity ? eventStr.includes(event.activity.toLowerCase()) : eventStr.includes('swim');
      const matchUnits = eventStr.includes(units.toLowerCase());
      return matchDistance && matchStroke && matchActivity && matchUnits;
    });
  };

  // Helper to calculate squad rank
  const getSquadRank = (event: any, anyItem: BestTimeResult, units: string, timeSeconds: number) => {
    const eventKey = `${event.distance}_${anyItem.stroke}_${event.activity}_${units}_${event.equipment || 'none'}`;
    const squadMates = squadBenchmarks?.[eventKey];
    
    // Debug logging
    if (!squadMates && squadBenchmarks && Object.keys(squadBenchmarks).length > 0) {
      console.log(`No squad benchmarks found for key: "${eventKey}"`, {
        availableKeys: Object.keys(squadBenchmarks),
        event: { distance: event.distance, stroke: anyItem.stroke, activity: event.activity, units, equipment: event.equipment }
      });
    }
    
    if (!squadMates || !swimmerId || squadMates.length < 3) return null;
    
    const sortedSwimmers = [...squadMates].sort((a, b) => a.time_seconds - b.time_seconds);
    const rankIndex = sortedSwimmers.findIndex(s => s.swimmer_id === swimmerId);
    
    // If swimmer not found in squad data, don't show rank
    if (rankIndex === -1) {
      console.log(`Swimmer ${swimmerId} not found in squad benchmarks for ${eventKey}`, {
        availableSwimmers: sortedSwimmers.map(s => s.swimmer_id)
      });
      return null;
    }
    
    const rank = rankIndex + 1;
    const isLeader = rank === 1;
    
    return { rank, total: sortedSwimmers.length, isLeader };
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl shadow-lg">
      <div className="overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/50">
              {/* Left outer - SCM Prediction */}
              {showPredictions && (
                <th className="text-center px-2 py-3 text-xs font-semibold text-purple-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <Sparkles size={12} />
                    <span className="hidden xl:inline">SCM Pred</span>
                    <span className="xl:hidden">Pred</span>
                    {onShowPredictionsGuide && (
                      <button
                        onClick={onShowPredictionsGuide}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-purple-500/20 transition-colors"
                        title="How AI Predictions Work"
                      >
                        <HelpCircle size={11} className="text-purple-400/70 hover:text-purple-300" />
                      </button>
                    )}
                  </div>
                </th>
              )}
              
              {/* SCM Standards */}
              {hasStandardsEnabled && showStandards && (
                <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <button
                    onClick={() => setShowStandards?.(!showStandards)}
                    className="flex items-center justify-center gap-1 hover:text-cyan-400 transition-colors mx-auto"
                  >
                    <Eye size={12} />
                    <span className="hidden lg:inline">Std</span>
                  </button>
                </th>
              )}
              
              {/* SCM Squad Rank */}
              {hasSquadData && showSquadRanks && (
                <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <Users size={12} className="mx-auto text-slate-500" />
                </th>
              )}
              
              {/* SCM Actual */}
              <th className="text-center px-3 py-3 text-xs font-semibold text-cyan-400 uppercase tracking-wider whitespace-nowrap">SCM</th>
              
              {/* Center - Event Info */}
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Event</th>
              
              {/* LCM Actual */}
              <th className="text-center px-3 py-3 text-xs font-semibold text-blue-400 uppercase tracking-wider whitespace-nowrap">LCM</th>
              
              {/* LCM Squad Rank */}
              {hasSquadData && showSquadRanks && (
                <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <Users size={10} className="mx-auto" />
                </th>
              )}
              
              {/* LCM Standards */}
              {hasStandardsEnabled && showStandards && (
                <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  <span className="hidden lg:inline">Std</span>
                </th>
              )}
              
              {/* Right outer - LCM Prediction */}
              {showPredictions && (
                <th className="text-center px-2 py-3 text-xs font-semibold text-purple-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <span className="hidden xl:inline">LCM Pred</span>
                    <span className="xl:hidden">Pred</span>
                    <Sparkles size={12} />
                  </div>
                </th>
              )}
              
              {/* SCY Columns (conditional) */}
              {hasScyResults && (
                <>
                  {showPredictions && (
                    <th className="text-center px-2 py-3 text-xs font-semibold text-purple-400 uppercase tracking-wider whitespace-nowrap border-l border-slate-700/50">
                      <div className="flex items-center justify-center gap-1">
                        <Sparkles size={12} />
                        <span className="hidden xl:inline">SCY Pred</span>
                        <span className="xl:hidden">Pred</span>
                      </div>
                    </th>
                  )}
                  {hasStandardsEnabled && showStandards && (
                    <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <span className="hidden lg:inline">Std</span>
                    </th>
                  )}
                  {hasSquadData && showSquadRanks && (
                    <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <Users size={10} className="mx-auto" />
                    </th>
                  )}
                  <th className="text-center px-3 py-3 text-xs font-semibold text-indigo-400 uppercase tracking-wider whitespace-nowrap">SCY</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {groupedData.map((group) => (
              <>
                <tr key={`header-${group.stroke}`} className="bg-slate-800/30">
                  <td colSpan={99} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-cyan-400" />
                      <span className="text-sm font-semibold text-slate-100">{group.label}</span>
                      <span className="text-xs text-slate-500">({group.events.length} events)</span>
                    </div>
                  </td>
                </tr>
                {group.events.map((event, eventIndex) => {
                  const scmItem = event.items.find(i => i.resultUnits === 'SCM');
                  const lcmItem = event.items.find(i => i.resultUnits === 'LCM');
                  const scyItem = event.items.find(i => i.resultUnits === 'SCY');
                  const anyItem = scmItem || lcmItem || scyItem!;
                  
                  const scmPrediction = findPrediction(event, anyItem, 'scm');
                  const lcmPrediction = findPrediction(event, anyItem, 'lcm');
                  const scyPrediction = findPrediction(event, anyItem, 'scy');
                  
                  const showTooltipBelow = eventIndex < 3;
                  
                  return (
                    <tr 
                      key={`${group.stroke}-${event.distance}-${event.activity}-${event.equipment}`}
                      className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Left outer - SCM Prediction */}
                      {showPredictions && (
                        <td className="px-2 py-3 text-center">
                          {!predictionsLoading && scmPrediction ? (
                            <PredictionBadge prediction={scmPrediction} showTooltipBelow={showTooltipBelow} compact />
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      )}
                      
                      {/* SCM Standards */}
                      {hasStandardsEnabled && showStandards && (
                        <td className="px-2 py-3 text-center">
                          {scmItem && event.activity?.toLowerCase() === 'swim' && swimmerAge ? (
                            <StandardsCell
                              standardsSetId={selectedStandardsSetId!}
                              distance={event.distance}
                              stroke={anyItem.stroke}
                              timeSeconds={scmItem.timeSeconds}
                              resultUnits="SCM"
                              swimmerAge={swimmerAge}
                              swimmerSex={swimmerSex}
                            />
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      )}
                      
                      {/* SCM Squad Rank */}
                      {hasSquadData && showSquadRanks && (
                        <td className="px-2 py-3 text-center">
                          {scmItem && (() => {
                            const rankData = getSquadRank(event, anyItem, 'SCM', scmItem.timeSeconds);
                            return rankData ? <SquadRankBadge {...rankData} /> : <span className="text-slate-600 text-xs">—</span>;
                          })()}
                        </td>
                      )}
                      
                      {/* SCM Actual */}
                      <td className="px-3 py-3 text-center">
                        {scmItem ? (
                          <button
                            onClick={() => onCardPress?.(scmItem)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-linear-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-500/30 rounded-lg hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200"
                          >
                            <Clock size={13} className="text-cyan-400 transition-colors shrink-0" />
                            <span className="text-sm font-bold text-cyan-300 font-mono tracking-tight transition-colors">
                              {formatTime(scmItem.timeSeconds)}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      
                      {/* Center - Event */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-slate-100">{event.distance}</span>
                            <span className="text-xs text-slate-500 uppercase">
                              {anyItem.units === "yards" ? "yd" : "m"}
                            </span>
                            <span className="text-sm text-slate-400 ml-1">{STROKE_LABEL[anyItem.stroke] ?? anyItem.stroke}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ` + getActivityStyles(event.activity)}>
                            {labelActivity(event.activity)}
                          </span>
                          {event.equipment !== "none" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700/50 text-slate-400 text-xs">
                              {event.equipment}
                            </span>
                          )}
                        </div>
                      </td>

                      
                      {/* LCM Actual */}
                      <td className="px-3 py-3 text-center">
                        {lcmItem ? (
                          <button
                            onClick={() => onCardPress?.(lcmItem)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/30 rounded-lg hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200"
                          >
                            <Clock size={13} className="text-blue-400 transition-colors shrink-0" />
                            <span className="text-sm font-bold text-blue-300 font-mono tracking-tight transition-colors">
                              {formatTime(lcmItem.timeSeconds)}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      
                      {/* LCM Squad Rank */}
                      {hasSquadData && showSquadRanks && (
                        <td className="px-2 py-3 text-center">
                          {lcmItem && (() => {
                            const rankData = getSquadRank(event, anyItem, 'LCM', lcmItem.timeSeconds);
                            return rankData ? <SquadRankBadge {...rankData} /> : <span className="text-slate-600 text-xs">—</span>;
                          })()}
                        </td>
                      )}
                      
                      {/* LCM Standards */}
                      {hasStandardsEnabled && showStandards && (
                        <td className="px-2 py-3 text-center">
                          {lcmItem && event.activity?.toLowerCase() === 'swim' && swimmerAge ? (
                            <StandardsCell
                              standardsSetId={selectedStandardsSetId!}
                              distance={event.distance}
                              stroke={anyItem.stroke}
                              timeSeconds={lcmItem.timeSeconds}
                              resultUnits="LCM"
                              swimmerAge={swimmerAge}
                              swimmerSex={swimmerSex}
                            />
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      )}
                      
                      {/* Right outer - LCM Prediction */}
                      {showPredictions && (
                        <td className="px-2 py-3 text-center">
                          {!predictionsLoading && lcmPrediction ? (
                            <PredictionBadge prediction={lcmPrediction} showTooltipBelow={showTooltipBelow} compact />
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      )}
                      
                      {/* SCY Columns (conditional) */}
                      {hasScyResults && (
                        <>
                          {showPredictions && (
                            <td className="px-2 py-3 text-center border-l border-slate-700/50">
                              {!predictionsLoading && scyPrediction ? (
                                <PredictionBadge prediction={scyPrediction} showTooltipBelow={showTooltipBelow} compact />
                              ) : (
                                <span className="text-slate-600 text-xs">—</span>
                              )}
                            </td>
                          )}
                          {hasStandardsEnabled && showStandards && (
                            <td className="px-2 py-3 text-center">
                              {scyItem && event.activity?.toLowerCase() === 'swim' && swimmerAge ? (
                                <StandardsCell
                                  standardsSetId={selectedStandardsSetId!}
                                  distance={event.distance}
                                  stroke={anyItem.stroke}
                                  timeSeconds={scyItem.timeSeconds}
                                  resultUnits="SCY"
                                  swimmerAge={swimmerAge}
                                  swimmerSex={swimmerSex}
                                />
                              ) : (
                                <span className="text-slate-600 text-xs">—</span>
                              )}
                            </td>
                          )}
                          {hasSquadData && showSquadRanks && (
                            <td className="px-2 py-3 text-center">
                              {scyItem && (() => {
                                const rankData = getSquadRank(event, anyItem, 'SCY', scyItem.timeSeconds);
                                return rankData ? <SquadRankBadge {...rankData} /> : <span className="text-slate-600 text-xs">—</span>;
                              })()}
                            </td>
                          )}
                          <td className="px-3 py-3 text-center">
                            {scyItem ? (
                              <button
                                onClick={() => onCardPress?.(scyItem)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-linear-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/30 rounded-lg hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200"
                              >
                                <Clock size={13} className="text-indigo-400 transition-colors shrink-0" />
                                <span className="text-sm font-bold text-indigo-300 font-mono tracking-tight transition-colors">
                                  {formatTime(scyItem.timeSeconds)}
                                </span>
                              </button>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
