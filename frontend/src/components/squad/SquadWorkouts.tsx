// components/squad/SquadWorkouts.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  Search,
  Clock,
  Flame,
  Activity,
  Calendar,
  Copy,
  Edit,
  Trash2,
  TrendingUp,
  Eye,
} from "lucide-react";
import { SquadPageHeader } from '@/components/squad/SquadPageHeader';
import WorkoutMiniChart from '@/components/workout/WorkoutMiniChart';
import {
  getSquadWorkouts,
  deleteWorkout,
  duplicateWorkout,
  type WorkoutTemplate,
} from '@/services/workoutLibraryService';

type Props = {
  squadId: string;
  canManage: boolean;
};

export default function SquadWorkouts({ squadId, canManage }: Props) {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<WorkoutTemplate[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "meters" | "usage">("recent");
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setWorkouts([]);
    setPage(0);
    setHasMore(true);
    loadWorkouts(0, true);
  }, [squadId]);

  useEffect(() => {
    filterAndSortWorkouts();
  }, [workouts, searchQuery, sortBy]);

  const loadWorkouts = async (pageNum: number, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const { workouts: data, hasMore: more, total } = await getSquadWorkouts(squadId, {
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });
      
      setWorkouts(prev => reset ? data : [...prev, ...data]);
      setHasMore(more);
      setTotalCount(total);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load workouts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadWorkouts(nextPage, false);
    }
  }, [loadingMore, hasMore, page, squadId]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0, rootMargin: '200px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadingMore, loadMore]);

  const filterAndSortWorkouts = () => {
    let filtered = [...workouts];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.raw_description.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "meters":
          return b.total_meters - a.total_meters;
        case "usage":
          return (b.usage_count || 0) - (a.usage_count || 0);
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredWorkouts(filtered);
  };

  const handleCreateWorkout = () => {
    navigate("/workouts/create");
  };

  const handleViewWorkout = (workoutId: string) => {
    navigate(`/workouts/${workoutId}`);
  };

  const handleEditWorkout = (workoutId: string) => {
    navigate(`/workouts/${workoutId}/edit`);
  };

  const handleDuplicateWorkout = async (workoutId: string) => {
    try {
      await duplicateWorkout(workoutId);
      setWorkouts([]);
      setPage(0);
      setHasMore(true);
      loadWorkouts(0, true);
    } catch (e: any) {
      alert(e.message || "Failed to duplicate workout");
    }
  };

  const handleDeleteWorkout = async (workoutId: string, workoutName: string) => {
    if (!confirm(`Are you sure you want to delete "${workoutName}"?`)) {
      return;
    }

    try {
      await deleteWorkout(workoutId);
      setWorkouts([]);
      setPage(0);
      setHasMore(true);
      loadWorkouts(0, true);
    } catch (e: any) {
      alert(e.message || "Failed to delete workout");
    }
  };

  const getEffortLevelColor = (level: number) => {
    if (level <= 3) return "text-success";
    if (level <= 6) return "text-warning";
    return "text-danger";
  };

  const getEffortLevelBg = (level: number) => {
    if (level <= 3) return "bg-success/10 border-success/30";
    if (level <= 6) return "bg-warning/10 border-warning/30";
    return "bg-danger/10 border-danger/30";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "N/A";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <SquadPageHeader
        title="Workout Library"
        subtitle={`${totalCount} workout${totalCount !== 1 ? 's' : ''} in your library`}
        actions={
          canManage ? (
            <button
              onClick={handleCreateWorkout}
              className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-primary to-accent text-white rounded-xl font-semibold text-sm hover:scale-105 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
            >
              <Plus size={18} />
              Create Workout
            </button>
          ) : undefined
        }
      />

      {/* Search and Filter Bar */}
      <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search workouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-background-tertiary/50 border border-border/40 rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            />
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            {[
              { key: "recent" as const, label: "Recent" },
              { key: "name" as const, label: "Name" },
              { key: "meters" as const, label: "Distance" },
              { key: "usage" as const, label: "Most Used" },
            ].map((sort) => (
              <button
                key={sort.key}
                onClick={() => setSortBy(sort.key)}
                className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
                  sortBy === sort.key
                    ? "bg-linear-to-r from-primary to-accent text-white shadow-lg shadow-primary/40"
                    : "bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary hover:shadow-md border border-border/40"
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger/10 border-l-4 border-danger rounded-lg p-4 mb-6">
          <p className="text-danger font-medium">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-background-elevated rounded-2xl border border-border/60 p-6 animate-pulse"
            >
              <div className="h-6 bg-background-tertiary rounded-lg w-3/4 mb-4"></div>
              <div className="h-4 bg-background-tertiary rounded-lg w-full mb-2"></div>
              <div className="h-4 bg-background-tertiary rounded-lg w-2/3 mb-4"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-background-tertiary rounded-lg flex-1"></div>
                <div className="h-8 bg-background-tertiary rounded-lg flex-1"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workouts Grid */}
      {!loading && filteredWorkouts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkouts.map((workout) => (
            <div
              key={workout.id}
              className="group bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-2xl hover:border-primary/40 transition-all duration-300 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-text-primary mb-1 line-clamp-1">
                    {workout.name}
                  </h3>
                  <p className="text-xs text-text-muted">
                    Created {formatDate(workout.created_at)}
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getEffortLevelBg(
                    workout.effort_level
                  )} ${getEffortLevelColor(workout.effort_level)}`}
                >
                  Level {workout.effort_level}
                </div>
              </div>

              {/* Description Preview */}
              <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                {workout.raw_description}
              </p>

              {/* Workout Breakdown Mini Chart */}
              {workout.json_description && (
                <div className="mb-2">
                  <WorkoutMiniChart workoutId={workout.id} showLegend={false} />
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/40 px-1">
                <div className="flex items-center gap-1">
                  <Activity size={12} className="text-primary" />
                  <span className="text-xs font-semibold text-text-primary">
                    {workout.total_meters}m
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={12} className="text-accent" />
                  <span className="text-xs font-semibold text-text-primary">
                    {workout.estimated_time_minutes}min
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame size={12} className="text-warning" />
                  <span className="text-xs font-semibold text-text-primary">
                    {workout.estimated_calories}
                  </span>
                </div>
              </div>

              {/* Usage Info */}
              <div className="flex items-center gap-4 mb-2 text-xs">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <TrendingUp size={14} />
                  <span>
                    Used {workout.usage_count || 0} time{workout.usage_count !== 1 ? "s" : ""}
                  </span>
                </div>
                {workout.last_used_at && (
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <Calendar size={14} />
                    <span>Last: {formatDate(workout.last_used_at)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewWorkout(workout.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-linear-to-r from-primary to-accent text-white rounded-lg font-semibold text-xs hover:scale-105 transition-all duration-200 shadow-md"
                >
                  <Eye size={14} />
                  View
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={() => handleEditWorkout(workout.id)}
                      className="px-2.5 py-2 bg-background-secondary/80 border border-border/40 text-text-secondary hover:text-primary hover:bg-primary/10 hover:border-primary/50 rounded-lg transition-all duration-200"
                      title="Edit workout"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDuplicateWorkout(workout.id)}
                      className="px-2.5 py-2 bg-background-secondary/80 border border-border/40 text-text-secondary hover:text-accent hover:bg-accent/10 hover:border-accent/50 rounded-lg transition-all duration-200"
                      title="Duplicate workout"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkout(workout.id, workout.name)}
                      className="px-2.5 py-2 bg-background-secondary/80 border border-border/40 text-text-secondary hover:text-danger hover:bg-danger/10 hover:border-danger/50 rounded-lg transition-all duration-200"
                      title="Delete workout"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading More Indicator */}
      {!loading && workouts.length > 0 && (
        <div ref={observerTarget} className="mt-6 min-h-[100px]">
          {loadingMore && (
            <div className="flex justify-center items-center py-8">
              <div className="flex items-center gap-3 text-text-muted">
                <div className="w-5 h-5 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Loading more workouts...</span>
              </div>
            </div>
          )}
          {!loadingMore && !hasMore && workouts.length > PAGE_SIZE && (
            <div className="text-center py-6">
              <p className="text-sm text-text-muted">You've reached the end of your workout library</p>
            </div>
          )}
          {!loadingMore && hasMore && !searchQuery && (
            <div className="text-center py-6">
              <p className="text-xs text-text-muted">Scroll down to load more...</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredWorkouts.length === 0 && !searchQuery && (
        <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 p-12 text-center shadow-xl">
          <div className="w-20 h-20 mx-auto mb-6 bg-linear-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
            <FileText className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Workouts Yet</h3>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            Start building your workout library by creating your first workout. You can create workouts without assigning them to sessions.
          </p>
          <button
            onClick={handleCreateWorkout}
            className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-primary to-accent text-white rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-lg"
          >
            <Plus size={20} />
            Create Your First Workout
          </button>
        </div>
      )}

      {/* No Results State */}
      {!loading && filteredWorkouts.length === 0 && searchQuery && (
        <div className="bg-background-elevated rounded-2xl border border-border/60 p-12 text-center">
          <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Results Found</h3>
          <p className="text-text-secondary">
            No workouts match your search query "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  );
}
