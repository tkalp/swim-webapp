import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  getSquadRankings, 
  getAvailableDistances, 
  formatTime,
  type StrokeType, 
  type ActivityType, 
  type SwimmerRanking,
  type EventQuery
} from '@/services/workoutResultService';
import { SquadPageHeader } from '@/components/squad/SquadPageHeader';
import { Trophy, Medal, Award, Timer, Eye, EyeOff, Clock, ExternalLink } from "lucide-react";
import AttemptsModal from '@/components/swimmers/bestTimes/AttemptsModal';

const STROKES: { value: StrokeType; label: string }[] = [
  { value: "free", label: "Freestyle" },
  { value: "back", label: "Backstroke" },
  { value: "breast", label: "Breaststroke" },
  { value: "fly", label: "Butterfly" },
  { value: "im", label: "Individual Medley" },
];

const ACTIVITIES: { value: ActivityType; label: string }[] = [
  { value: "swim", label: "Swim" },
  { value: "kick", label: "Kick" },
  { value: "pull", label: "Pull" },
];

type Props = {
  squadId: string;
};

export default function SquadRankings({ squadId }: Props) {
  const navigate = useNavigate();
  const [stroke, setStroke] = useState<StrokeType>("free");
  const [activity, setActivity] = useState<ActivityType>("swim");
  const [availableDistances, setAvailableDistances] = useState<number[]>([]);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [scmRankings, setScmRankings] = useState<SwimmerRanking[]>([]);
  const [lcmRankings, setLcmRankings] = useState<SwimmerRanking[]>([]);
  const [scyRankings, setScyRankings] = useState<SwimmerRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attemptsModalOpen, setAttemptsModalOpen] = useState(false);
  const [selectedEventQuery, setSelectedEventQuery] = useState<EventQuery | null>(null);

  // Load available distances when stroke/activity changes (check SCM as primary)
  useEffect(() => {
    let mounted = true;

    const loadDistances = async () => {
      try {
        const distances = await getAvailableDistances(squadId, stroke, activity, 'SCM');
        if (mounted) {
          setAvailableDistances(distances);
          // Auto-select first distance if available
          if (distances.length > 0) {
            setSelectedDistance(distances[0]);
          } else {
            setSelectedDistance(null);
            setScmRankings([]);
            setLcmRankings([]);
            setScyRankings([]);
          }
        }
      } catch (e: any) {
        if (mounted) {
          setError(e.message || "Failed to load distances");
        }
      }
    };

    loadDistances();

    return () => {
      mounted = false;
    };
  }, [squadId, stroke, activity]);

  // Load rankings for all pool types when distance changes
  useEffect(() => {
    if (!selectedDistance) {
      setScmRankings([]);
      setLcmRankings([]);
      setScyRankings([]);
      return;
    }

    let mounted = true;

    const loadRankings = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch all three pool types in parallel
        const [scmData, lcmData, scyData] = await Promise.all([
          getSquadRankings(squadId, stroke, activity, selectedDistance, 'SCM').catch(() => []),
          getSquadRankings(squadId, stroke, activity, selectedDistance, 'LCM').catch(() => []),
          getSquadRankings(squadId, stroke, activity, selectedDistance, 'SCY').catch(() => [])
        ]);
        
        if (mounted) {
          setScmRankings(scmData);
          setLcmRankings(lcmData);
          setScyRankings(scyData);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e.message || "Failed to load rankings");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadRankings();

    return () => {
      mounted = false;
    };
  }, [squadId, stroke, activity, selectedDistance]);

  // Combine rankings from all pool types to create unified swimmer list
  const combinedRankings = useMemo(() => {
    const swimmerMap = new Map<string, {
      swimmer_id: string;
      swimmer_name: string;
      date_of_birth?: string;
      sex?: string;
      scm?: SwimmerRanking;
      lcm?: SwimmerRanking;
      scy?: SwimmerRanking;
      bestTime: number;
    }>();

    // Add SCM results
    scmRankings.forEach(r => {
      swimmerMap.set(r.swimmer_id, {
        swimmer_id: r.swimmer_id,
        swimmer_name: r.swimmer_name,
        date_of_birth: r.date_of_birth,
        sex: r.sex,
        scm: r,
        bestTime: r.best_time
      });
    });

    // Add LCM results
    lcmRankings.forEach(r => {
      const existing = swimmerMap.get(r.swimmer_id);
      if (existing) {
        existing.lcm = r;
        existing.bestTime = Math.min(existing.bestTime, r.best_time);
      } else {
        swimmerMap.set(r.swimmer_id, {
          swimmer_id: r.swimmer_id,
          swimmer_name: r.swimmer_name,
          date_of_birth: r.date_of_birth,
          sex: r.sex,
          lcm: r,
          bestTime: r.best_time
        });
      }
    });

    // Add SCY results
    scyRankings.forEach(r => {
      const existing = swimmerMap.get(r.swimmer_id);
      if (existing) {
        existing.scy = r;
        existing.bestTime = Math.min(existing.bestTime, r.best_time);
      } else {
        swimmerMap.set(r.swimmer_id, {
          swimmer_id: r.swimmer_id,
          swimmer_name: r.swimmer_name,
          date_of_birth: r.date_of_birth,
          sex: r.sex,
          scy: r,
          bestTime: r.best_time
        });
      }
    });

    // Sort by best overall time
    return Array.from(swimmerMap.values()).sort((a, b) => a.bestTime - b.bestTime);
  }, [scmRankings, lcmRankings, scyRankings]);

  const hasScyResults = scyRankings.length > 0;

  const handleTimeClick = (swimmerId: string, resultUnits: string) => {
    if (!selectedDistance) return;
    
    setSelectedEventQuery({
      swimmerId,
      distance: selectedDistance,
      stroke,
      activity,
      equipment: 'none',
      units: resultUnits === 'SCY' ? 'yards' : 'meters',
      resultUnits
    });
    setAttemptsModalOpen(true);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />;
    return <span className="text-sm font-semibold text-slate-500">#{rank}</span>;
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <SquadPageHeader
        title="Squad Rankings"
        subtitle="Compare swimmer performance by stroke and activity"
      />

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {/* Stroke Selection Card */}
        <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
          <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative">
            <label className="block text-[10px] font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text mb-2 uppercase tracking-wider">Stroke</label>
            <div className="flex flex-wrap gap-1.5">
              {STROKES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStroke(s.value)}
                  className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-all duration-200 ${
                    stroke === s.value
                      ? "bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/30"
                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/70 hover:text-slate-200 border border-slate-700/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Selection Card */}
        <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="absolute inset-0 bg-linear-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative">
            <label className="block text-[10px] font-bold text-transparent bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text mb-2 uppercase tracking-wider">Activity</label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setActivity(a.value)}
                  className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-all duration-200 ${
                    activity === a.value
                      ? "bg-linear-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/30"
                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/70 hover:text-slate-200 border border-slate-700/40"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Distance Selection Card */}
        <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative">
            <label className="block text-[10px] font-bold text-transparent bg-linear-to-r from-emerald-400 to-green-400 bg-clip-text mb-2 uppercase tracking-wider">Distance</label>
            {availableDistances.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {availableDistances.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDistance(d)}
                    className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-all duration-200 ${
                      selectedDistance === d
                        ? "bg-linear-to-r from-emerald-500 to-green-500 text-white shadow-md shadow-emerald-500/30"
                        : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/70 hover:text-slate-200 border border-slate-700/40"
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-[11px] italic">No distances available</p>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border-l-4 border-red-500 rounded-lg p-3 backdrop-blur-sm shadow-md">
          <p className="text-red-400 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-8 shadow-lg animate-pulse">
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-800/60 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-5 bg-slate-800/60 rounded-lg w-1/3 mb-2"></div>
                  <div className="h-3 bg-slate-800/60 rounded-lg w-1/4"></div>
                </div>
                <div className="w-20 h-6 bg-slate-800/60 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rankings Table */}
      {!loading && combinedRankings.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-slate-800">
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rank</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Swimmer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SCM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">LCM</th>
                  {hasScyResults && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SCY</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {combinedRankings.map((ranking, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  
                  return (
                    <tr
                      key={ranking.swimmer_id}
                      className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Rank Column */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center w-10">
                          {getRankIcon(rank)}
                        </div>
                      </td>
                      
                      {/* Swimmer Column */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-lg transition-transform duration-300 hover:scale-110 ${
                            rank === 1 ? "bg-linear-to-br from-yellow-400 to-yellow-600 text-white shadow-yellow-500/40" :
                            rank === 2 ? "bg-linear-to-br from-gray-300 to-gray-500 text-white shadow-gray-400/40" :
                            rank === 3 ? "bg-linear-to-br from-amber-600 to-amber-800 text-white shadow-amber-700/40" :
                            "bg-linear-to-br from-slate-700 to-slate-600 text-slate-300 shadow-slate-700/30"
                          }`}>
                            {ranking.swimmer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`font-semibold text-sm ${
                              isTopThree ? "text-slate-100" : "text-slate-400"
                            }`}>
                              {ranking.swimmer_name}
                            </div>
                            <button
                              onClick={() => navigate(`/swimmers/${ranking.swimmer_id}`)}
                              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 rounded transition-all"
                              title="View swimmer profile"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          </div>
                        </div>
                      </td>
                      
                      {/* SCM Column */}
                      <td className="px-4 py-3">
                        {ranking.scm ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleTimeClick(ranking.swimmer_id, 'SCM')}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-linear-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg w-fit hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-500/40 transition-all cursor-pointer"
                            >
                              <Clock size={14} className="text-cyan-400" />
                              <span className="text-sm font-bold text-cyan-400">
                                {formatTime(ranking.scm.best_time)}
                              </span>
                            </button>
                            <span className="text-[10px] text-slate-500">
                              {ranking.scm.result_count} result{ranking.scm.result_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </td>
                      
                      {/* LCM Column */}
                      <td className="px-4 py-3">
                        {ranking.lcm ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleTimeClick(ranking.swimmer_id, 'LCM')}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-linear-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg w-fit hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-500/40 transition-all cursor-pointer"
                            >
                              <Clock size={14} className="text-cyan-400" />
                              <span className="text-sm font-bold text-cyan-400">
                                {formatTime(ranking.lcm.best_time)}
                              </span>
                            </button>
                            <span className="text-[10px] text-slate-500">
                              {ranking.lcm.result_count} result{ranking.lcm.result_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </td>
                      
                      {/* SCY Column (conditional) */}
                      {hasScyResults && (
                        <td className="px-4 py-3">
                          {ranking.scy ? (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleTimeClick(ranking.swimmer_id, 'SCY')}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-linear-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg w-fit hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-500/40 transition-all cursor-pointer"
                              >
                                <Clock size={14} className="text-cyan-400" />
                                <span className="text-sm font-bold text-cyan-400">
                                  {formatTime(ranking.scy.best_time)}
                                </span>
                              </button>
                              <span className="text-[10px] text-slate-500">
                                {ranking.scy.result_count} result{ranking.scy.result_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && combinedRankings.length === 0 && selectedDistance && (
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-12 shadow-lg text-center">
          <Trophy className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-slate-100 mb-2">No Results Found</h3>
          <p className="text-slate-400 text-sm">
            No workout results found for {selectedDistance}m {STROKES.find(s => s.value === stroke)?.label} {ACTIVITIES.find(a => a.value === activity)?.label}
          </p>
        </div>
      )}

      {/* Attempts Modal */}
      {selectedEventQuery && (
        <AttemptsModal
          open={attemptsModalOpen}
          onClose={() => setAttemptsModalOpen(false)}
          query={selectedEventQuery}
          canManageResults={false}
        />
      )}
    </div>
  );
}
