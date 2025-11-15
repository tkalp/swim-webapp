import { useEffect, useState } from "react";
import { 
  getSquadRankings, 
  getAvailableDistances, 
  formatTime,
  type StrokeType, 
  type ActivityType, 
  type SwimmerRanking 
} from "../../services/workoutResultService";
import { SquadPageHeader } from "./SquadPageHeader";
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
    return <span className="text-sm font-semibold text-text-tertiary">#{rank}</span>;
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <SquadPageHeader
        title="Squad Rankings"
        subtitle="Compare swimmer performance by stroke and activity"
      />

      {/* Filters */}
      <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl mb-6">
        <div className="flex flex-col gap-4">
          {/* Stroke Selection */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Stroke</label>
            <div className="flex flex-wrap gap-2">
              {STROKES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStroke(s.value)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    stroke === s.value
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30"
                      : "bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Selection */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Activity</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setActivity(a.value)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    activity === a.value
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30"
                      : "bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pool Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Pool Type</label>
            <div className="flex flex-wrap gap-2">
              {RESULT_UNITS.map((ru) => (
                <button
                  key={ru.value}
                  onClick={() => setResultUnits(ru.value)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    resultUnits === ru.value
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30"
                      : "bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary"
                  }`}
                >
                  {ru.label}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Selection */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Distance</label>
            {availableDistances.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableDistances.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDistance(d)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      selectedDistance === d
                        ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30"
                        : "bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary"
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-text-tertiary text-sm italic">No distances available for this stroke/activity combination</p>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger/10 border-l-4 border-danger rounded-lg p-3 backdrop-blur-sm shadow-md">
          <p className="text-danger text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-background-elevated rounded-xl border border-border/60 p-8 shadow-lg animate-pulse">
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-background-tertiary rounded-full"></div>
                <div className="flex-1">
                  <div className="h-5 bg-background-tertiary rounded-lg w-1/3 mb-2"></div>
                  <div className="h-3 bg-background-tertiary rounded-lg w-1/4"></div>
                </div>
                <div className="w-20 h-6 bg-background-tertiary rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rankings Table */}
      {!loading && rankings.length > 0 && (
        <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 backdrop-blur-sm shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-background-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary uppercase tracking-wider">
                    Swimmer
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-primary uppercase tracking-wider">
                    <div className="flex items-center justify-end gap-1">
                      <Timer className="w-3 h-3" />
                      Best Time
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-primary uppercase tracking-wider">
                    Results
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rankings.map((ranking, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  
                  return (
                    <tr
                      key={ranking.swimmer_id}
                      className={`group hover:bg-background-secondary/50 transition-colors duration-150 ${
                        isTopThree ? "bg-background-secondary/20" : ""
                      }`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center w-8">
                          {getRankIcon(rank)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            rank === 1 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/30" :
                            rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-lg shadow-gray-400/30" :
                            rank === 3 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-700/30" :
                            "bg-background-tertiary text-text-secondary"
                          }`}>
                            {ranking.swimmer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className={`font-medium ${isTopThree ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                            {ranking.swimmer_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-mono font-semibold ${isTopThree ? "text-text-primary text-lg" : "text-text-secondary"}`}>
                          {formatTime(ranking.best_time)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
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
        <div className="bg-background-elevated rounded-xl border border-border/60 p-12 shadow-lg text-center">
          <Trophy className="w-16 h-16 text-text-tertiary mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Results Found</h3>
          <p className="text-text-secondary text-sm">
            No workout results found for {selectedDistance}m {STROKES.find(s => s.value === stroke)?.label} {ACTIVITIES.find(a => a.value === activity)?.label}
          </p>
        </div>
      )}
    </div>
  );
}
