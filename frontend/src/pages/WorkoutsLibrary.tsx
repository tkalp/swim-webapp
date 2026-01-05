// pages/WorkoutsLibrary.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Dumbbell,
  Plus,
  Search,
  Clock,
  Flame,
  Activity,
  Copy,
  Edit,
  Trash2,
  Eye,
  Filter,
  Users,
  Tag as TagIcon,
  X,
  Share2,
  Star,
  Calendar,
} from "lucide-react";
import WorkoutMiniChart from '@/components/workout/WorkoutMiniChart';
import { WorkoutTag } from '@/components/workout/WorkoutTag';
import WorkoutRatingStars from '@/components/workouts/WorkoutRatingStars';
import { AssignWorkoutToSessionModal } from '@/components/workouts/AssignWorkoutToSessionModal';
import WorkoutVisibilityBadge from '@/components/workouts/WorkoutVisibilityBadge';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import {
  getCoachWorkouts,
  deleteWorkout,
  duplicateWorkout,
  type WorkoutTemplate,
} from '@/services/workoutLibraryService';
import { getCoachTags } from '@/services/workoutTagService';
import { updateWorkoutVisibility, type WorkoutVisibility } from '@/services/workoutSharingService';
import type { WorkoutTag as WorkoutTagType } from '@/types/workoutTags';

export default function WorkoutsLibrary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const coachId = user?.id;

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
  const [allTags, setAllTags] = useState<WorkoutTagType[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'OR' | 'AND'>('OR');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [workoutToAssign, setWorkoutToAssign] = useState<WorkoutTemplate | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 12;

  useEffect(() => {
    if (!coachId) return;
    setWorkouts([]);
    setPage(0);
    setHasMore(true);
    loadWorkouts(0, true);
    loadTags();
  }, [coachId]);

  useEffect(() => {
    filterAndSortWorkouts();
  }, [workouts, searchQuery, sortBy, selectedTagIds, filterMode]);

  const loadTags = async () => {
    if (!coachId) return;
    try {
      const tags = await getCoachTags(coachId);
      setAllTags(tags);
    } catch (e) {
      console.error("Failed to load tags:", e);
    }
  };

  const loadWorkouts = async (pageNum: number, reset: boolean = false) => {
    if (!coachId) return;

    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { workouts: data, hasMore: more, total } = await getCoachWorkouts(coachId, {
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });

      setWorkouts((prev) => (reset ? data : [...prev, ...data]));
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
    // Don't load more if we're filtering - client-side filtering means we need all data loaded first
    if (!loadingMore && hasMore && coachId && !searchQuery && selectedTagIds.length === 0) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadWorkouts(nextPage, false);
    }
  }, [loadingMore, hasMore, page, coachId, searchQuery, selectedTagIds]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Only trigger infinite scroll if not filtering
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !searchQuery && selectedTagIds.length === 0) {
          loadMore();
        }
      },
      { threshold: 0, rootMargin: "200px" }
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
  }, [hasMore, loading, loadingMore, loadMore, searchQuery, selectedTagIds]);

  const filterAndSortWorkouts = () => {
    let filtered = [...workouts];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.raw_description.toLowerCase().includes(query) ||
          (w.description && w.description.toLowerCase().includes(query))
      );
    }

    // Filter by selected tags
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((w) => {
        if (!w.tags || w.tags.length === 0) return false;
        
        if (filterMode === 'OR') {
          // Show workout if it has ANY of the selected tags
          return w.tags.some((tag) => selectedTagIds.includes(tag.id));
        } else {
          // Show workout if it has ALL of the selected tags
          const workoutTags = w.tags; // Cache to help TypeScript
          return selectedTagIds.every((selectedId) =>
            workoutTags.some((tag) => tag.id === selectedId)
          );
        }
      });
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
    if (!confirm(`Are you sure you want to delete "${workoutName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteWorkout(workoutId);
      setWorkouts([]);
      setPage(0);
      setHasMore(true);
      loadWorkouts(0, true);
      showToast('Workout deleted successfully', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete workout', 'error');
    }
  };

  const handleChangeVisibility = async (workoutId: string, newVisibility: WorkoutVisibility) => {
    try {
      await updateWorkoutVisibility(workoutId, newVisibility);
      
      // Update local state
      setWorkouts(prev => prev.map(w => 
        w.id === workoutId ? { ...w, visibility: newVisibility } : w
      ));
      
      showToast(`Workout visibility updated to ${newVisibility}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update visibility', 'error');
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

  const handleAssignToSession = (workout: WorkoutTemplate) => {
    setWorkoutToAssign(workout);
    setAssignModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Workout Library
              </h1>
              <p className="text-slate-400 mt-1">
                {totalCount} workout{totalCount !== 1 ? "s" : ""} in your library
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/workouts/discover')}
                className="flex items-center gap-2 px-5 py-3 bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-xl font-semibold text-sm hover:bg-purple-500/30 hover:border-purple-500/60 transition-all duration-200"
              >
                <Star size={18} />
                Discover
              </button>
              <button
                onClick={handleCreateWorkout}
                className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold text-sm hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-200"
              >
                <Plus size={18} />
                Create Workout
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 sm:p-8 shadow-xl mb-6">
          <div className="flex flex-col gap-4">
            {/* Search and Sort Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search workouts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
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
                        ? "bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/40"
                        : "bg-slate-800/80 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200 hover:shadow-md border border-slate-700/40"
                    }`}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag Filter Row */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-md">
                  <MultiSelectDropdown
                    options={allTags.map(tag => ({
                      id: tag.id,
                      name: tag.name,
                      color: tag.color
                    }))}
                    selectedIds={selectedTagIds}
                    onChange={setSelectedTagIds}
                    placeholder="Filter by tags..."
                    label="Tags"
                    maxHeight="400px"
                  />
                </div>
                
                {selectedTagIds.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Match:</span>
                    <div className="flex gap-1 bg-slate-800/50 border border-slate-700/40 rounded-lg p-1">
                      <button
                        onClick={() => setFilterMode('OR')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          filterMode === 'OR'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ANY
                      </button>
                      <button
                        onClick={() => setFilterMode('AND')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          filterMode === 'AND'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ALL
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800/60 p-4 animate-pulse"
              >
                <div className="h-6 bg-slate-800/50 rounded-lg w-3/4 mb-4"></div>
                <div className="h-4 bg-slate-800/50 rounded-lg w-full mb-2"></div>
                <div className="h-4 bg-slate-800/50 rounded-lg w-2/3 mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-slate-800/50 rounded-lg flex-1"></div>
                  <div className="h-8 bg-slate-800/50 rounded-lg flex-1"></div>
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
                className="group bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg hover:shadow-2xl hover:border-cyan-500/40 transition-all duration-300 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-100 mb-0.5 line-clamp-1">
                      {workout.name}
                    </h3>
                    <p className="text-xs text-slate-500">Created {formatDate(workout.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <WorkoutVisibilityBadge visibility={workout.visibility || 'private'} size="sm" />
                    <div
                      className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${getEffortLevelBg(
                        workout.effort_level
                      )} ${getEffortLevelColor(workout.effort_level)}`}
                    >
                      Level {workout.effort_level}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {workout.tags && workout.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {workout.tags.map((tag) => (
                      <WorkoutTag key={tag.id} tag={tag} size="sm" />
                    ))}
                  </div>
                )}

                {/* Description Preview */}
                <p className="text-xs text-slate-400 mb-2 line-clamp-2">
                  {workout.description || workout.raw_description.slice(0, 100) + (workout.raw_description.length > 100 ? '...' : '')}
                </p>

                {/* Workout Breakdown Mini Chart */}
                {workout.json_description && (
                  <div className="mb-2">
                    <WorkoutMiniChart workoutId={workout.id} showLegend={false} />
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/40 px-1">
                  <div className="flex items-center gap-1">
                    <Activity size={12} className="text-cyan-400" />
                    <span className="text-xs font-semibold text-slate-100">{workout.total_meters}m</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-blue-400" />
                    <span className="text-xs font-semibold text-slate-100">
                      {workout.estimated_time_minutes}min
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame size={12} className="text-orange-400" />
                    <span className="text-xs font-semibold text-slate-100">{workout.estimated_calories}</span>
                  </div>
                </div>

                {/* Ratings & Usage Info */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <WorkoutRatingStars
                    rating={workout.effectiveness_rating || null}
                    ratingCount={workout.rating_count || 0}
                    size="sm"
                    showCount={true}
                  />
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users size={12} />
                    <span>{workout.times_used || 0} uses</span>
                  </div>
                </div>

                {/* Visibility Controls */}
                <div className="mb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Share2 size={12} className="text-slate-400" />
                    <span className="text-xs text-slate-400">Visibility:</span>
                  </div>
                  <select
                    value={workout.visibility || 'private'}
                    onChange={(e) => handleChangeVisibility(workout.id, e.target.value as WorkoutVisibility)}
                    className="w-full bg-slate-800/50 border border-slate-700/40 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                  >
                    <option value="private">Private - Only me</option>
                    <option value="network">Network - Connected coaches</option>
                    <option value="public">Public - Everyone</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewWorkout(workout.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold text-xs hover:scale-105 transition-all duration-200 shadow-md"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    onClick={() => handleAssignToSession(workout)}
                    className="px-2.5 py-2 bg-slate-800/80 border border-slate-700/40 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 rounded-lg transition-all duration-200"
                    title="Assign to session"
                  >
                    <Calendar size={14} />
                  </button>
                  <button
                    onClick={() => handleEditWorkout(workout.id)}
                    className="px-2.5 py-2 bg-slate-800/80 border border-slate-700/40 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 rounded-lg transition-all duration-200"
                    title="Edit workout"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDuplicateWorkout(workout.id)}
                    className="px-2.5 py-2 bg-slate-800/80 border border-slate-700/40 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 rounded-lg transition-all duration-200"
                    title="Duplicate workout"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteWorkout(workout.id, workout.name)}
                    className="px-2.5 py-2 bg-slate-800/80 border border-slate-700/40 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/50 rounded-lg transition-all duration-200"
                    title="Delete workout"
                  >
                    <Trash2 size={14} />
                  </button>
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
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="w-5 h-5 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Loading more workouts...</span>
                </div>
              </div>
            )}
            {!loadingMore && !hasMore && workouts.length > PAGE_SIZE && (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">You've reached the end of your workout library</p>
              </div>
            )}
            {!loadingMore && hasMore && (searchQuery || selectedTagIds.length > 0) && (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400 mb-3">Filtering is active. Load all workouts to see complete results.</p>
                <button
                  onClick={() => {
                    // Load all remaining workouts
                    const loadAll = async () => {
                      let currentPage = page + 1;
                      while (hasMore) {
                        await loadWorkouts(currentPage, false);
                        currentPage++;
                      }
                    };
                    loadAll();
                  }}
                  className="px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all text-sm font-medium"
                >
                  Load All Workouts
                </button>
              </div>
            )}
            {!loadingMore && hasMore && !searchQuery && selectedTagIds.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-slate-500">Scroll down to load more...</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredWorkouts.length === 0 && !searchQuery && (
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-12 text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-linear-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
              <Dumbbell className="w-10 h-10 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">No Workouts Yet</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Start building your workout library by creating your first workout.
            </p>
            <button
              onClick={handleCreateWorkout}
              className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:scale-105 transition-all duration-200 shadow-lg"
            >
              <Plus size={20} />
              Create Your First Workout
            </button>
          </div>
        )}

        {/* No Results State */}
        {!loading && filteredWorkouts.length === 0 && searchQuery && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/60 p-12 text-center">
            <Search className="w-16 h-16 text-slate-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-100 mb-2">No Results Found</h3>
            <p className="text-slate-400">No workouts match your search query "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Assign Workout to Session Modal */}
      {workoutToAssign && (
        <AssignWorkoutToSessionModal
          workout={{
            ...workoutToAssign,
            description: workoutToAssign.description || ''
          }}
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setWorkoutToAssign(null);
          }}
          onAssigned={() => {
            // Optionally refetch sessions or show success message
          }}
        />
      )}
    </div>
  );
}
