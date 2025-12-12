// components/swimmer/bestTimes/GroupedBestTimesView.tsx
import { useMemo, useState } from "react";
import type { BestTimeResult, SwimmerPredictionsResponse } from '@/services/workoutResultService';
import { formatTime } from '@/utils/timeUtils';
import { Clock, Activity, TrendingDown, TrendingUp, Eye, EyeOff, Sparkles, Users, Award, HelpCircle } from "lucide-react";
import { StandardsCell } from '@/components/swimmers/timeStandards';
import { calculateSwimmerAge } from '@/services/swimmerStandards';
import { PredictionBadge } from '@/components/shared/PredictionBadge';

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
      const stroke = anyItem.stroke.toLowerCase();
      const isYards = units === 'scy';
      
      // Match distance
      const matchDistance = isYards 
        ? eventStr.includes(`${event.distance}y`)
        : eventStr.includes(`${event.distance}m`);
      
      // Match stroke - be more specific to avoid "im" matching "swim" or partial matches
      const strokePatterns: Record<string, string[]> = {
        'free': ['free', 'freestyle'],
        'back': ['back', 'backstroke'],
        'breast': ['breast', 'breaststroke'],
        'fly': ['fly', 'butterfly'],
        'im': [' im ', 'individual medley', 'individualmedley']
      };
      const patterns = strokePatterns[stroke] || [stroke];
      const matchStroke = patterns.some(pattern => eventStr.includes(pattern));
      
      // Match activity
      const matchActivity = event.activity ? eventStr.includes(event.activity.toLowerCase()) : eventStr.includes('swim');
      
      // Match units
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
