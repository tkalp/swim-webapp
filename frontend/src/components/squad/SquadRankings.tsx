import { useEffect, useState } from "react";
import { 
  getSquadRankings, 
  getAvailableDistances, 
  formatTime,
  type StrokeType, 
  type ActivityType, 
  type SwimmerRanking 
} from '@/services/workoutResultService';
import { SquadPageHeader } from '@/components/squad/SquadPageHeader';
import { Trophy, Medal, Award, Timer } from "lucide-react";

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
  { value: "drill", label: "Drill" },
];

const RESULT_UNITS: { value: string; label: string }[] = [
  { value: "SCM", label: "SCM" },
  { value: "LCM", label: "LCM" },
  { value: "SCY", label: "SCY" },
];

type Props = {
  squadId: string;
};

export default function SquadRankings({ squadId }: Props) {
  const [stroke, setStroke] = useState<StrokeType>("free");
  const [activity, setActivity] = useState<ActivityType>("swim");
  const [resultUnits, setResultUnits] = useState<string>("SCM");
  const [availableDistances, setAvailableDistances] = useState<number[]>([]);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [rankings, setRankings] = useState<SwimmerRanking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load available distances when stroke/activity/resultUnits changes
  useEffect(() => {
    let mounted = true;

    const loadDistances = async () => {
      try {
        const distances = await getAvailableDistances(squadId, stroke, activity, resultUnits);
        if (mounted) {
          setAvailableDistances(distances);
          // Auto-select first distance if available
          if (distances.length > 0) {
            setSelectedDistance(distances[0]);
          } else {
            setSelectedDistance(null);
            setRankings([]);
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
  }, [squadId, stroke, activity, resultUnits]);

  // Load rankings when distance changes
  useEffect(() => {
    if (!selectedDistance) {
      setRankings([]);
      return;
    }

    let mounted = true;

    const loadRankings = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getSquadRankings(squadId, stroke, activity, selectedDistance, resultUnits);
        if (mounted) {
          setRankings(data);
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
      <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border-2 border-slate-800/60 p-6 sm:p-8 shadow-xl mb-6 overflow-hidden">
        {/* Animated glow orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        
        <div className="relative flex flex-col gap-6">
          {/* Stroke Selection */}
          <div>
            <label className="block text-sm font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text mb-3">Stroke</label>
            <div className="flex flex-wrap gap-2">
              {STROKES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStroke(s.value)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    stroke === s.value
                      ? "bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30 scale-105"
                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 hover:scale-105 border border-slate-700/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Selection */}
          <div>
            <label className="block text-sm font-bold text-transparent bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text mb-3">Activity</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setActivity(a.value)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    activity === a.value
                      ? "bg-linear-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 scale-105"
                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 hover:scale-105 border border-slate-700/40"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pool Type Selection */}
          <div>
            <label className="block text-sm font-bold text-transparent bg-linear-to-r from-orange-400 to-amber-400 bg-clip-text mb-3">Pool Type</label>
            <div className="flex flex-wrap gap-2">
              {RESULT_UNITS.map((ru) => (
                <button
                  key={ru.value}
                  onClick={() => setResultUnits(ru.value)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    resultUnits === ru.value
                      ? "bg-linear-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 scale-105"
                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 hover:scale-105 border border-slate-700/40"
                  }`}
                >
                  {ru.label}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Selection */}
          <div>
            <label className="block text-sm font-bold text-transparent bg-linear-to-r from-emerald-400 to-green-400 bg-clip-text mb-3">Distance</label>
            {availableDistances.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableDistances.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDistance(d)}
                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      selectedDistance === d
                        ? "bg-linear-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 scale-105"
                        : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 hover:scale-105 border border-slate-700/40"
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic">No distances available for this stroke/activity combination</p>
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
      {!loading && rankings.length > 0 && (
        <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border-2 border-slate-800/60 shadow-xl overflow-hidden">
          {/* Animated glow */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-linear-to-br from-yellow-500/10 via-cyan-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-800/60 bg-slate-800/40">
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text uppercase tracking-wider">
                    Swimmer
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text uppercase tracking-wider">
                    <div className="flex items-center justify-end gap-1.5">
                      <Timer className="w-4 h-4" />
                      Best Time
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text uppercase tracking-wider">
                    Results
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {rankings.map((ranking, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  
                  return (
                    <tr
                      key={ranking.swimmer_id}
                      className={`group hover:bg-slate-800/50 transition-all duration-300 ${
                        isTopThree ? "bg-slate-800/30" : ""
                      }`}
                    >
                      <td className="px-4 sm:px-6 py-5">
                        <div className="flex items-center justify-center w-10">
                          {getRankIcon(rank)}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-lg transition-transform duration-300 group-hover:scale-110 ${
                            rank === 1 ? "bg-linear-to-br from-yellow-400 to-yellow-600 text-white shadow-yellow-500/40" :
                            rank === 2 ? "bg-linear-to-br from-gray-300 to-gray-500 text-white shadow-gray-400/40" :
                            rank === 3 ? "bg-linear-to-br from-amber-600 to-amber-800 text-white shadow-amber-700/40" :
                            "bg-linear-to-br from-slate-700 to-slate-600 text-slate-300 shadow-slate-700/30"
                          }`}>
                            {ranking.swimmer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className={`font-semibold text-base ${
                            isTopThree ? "text-slate-100" : "text-slate-400 group-hover:text-slate-100"
                          }`}>
                            {ranking.swimmer_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-5 text-right">
                        <span className={`font-mono font-bold ${
                          isTopThree ? "text-slate-100 text-xl" : "text-slate-400 text-lg group-hover:text-slate-100"
                        }`}>
                          {formatTime(ranking.best_time)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-5 text-right">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-linear-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30">
                          {ranking.result_count}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && rankings.length === 0 && selectedDistance && (
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-12 shadow-lg text-center">
          <Trophy className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-slate-100 mb-2">No Results Found</h3>
          <p className="text-slate-400 text-sm">
            No workout results found for {selectedDistance}m {STROKES.find(s => s.value === stroke)?.label} {ACTIVITIES.find(a => a.value === activity)?.label}
          </p>
        </div>
      )}
    </div>
  );
}

