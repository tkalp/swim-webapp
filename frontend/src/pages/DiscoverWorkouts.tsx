import { useState, useEffect } from 'react';
import { Copy, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { discoverWorkouts, cloneWorkout, type SharedWorkout } from '@/services/workoutSharingService';
import { useToast } from '@/contexts/ToastContext';
import WorkoutRatingStars from '@/components/workouts/WorkoutRatingStars';
import WorkoutVisibilityBadge from '@/components/workouts/WorkoutVisibilityBadge';

export default function DiscoverWorkoutsPage() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<SharedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'rating' | 'popular' | 'recent'>('rating');
  const { showToast } = useToast();

  useEffect(() => {
    loadWorkouts();
  }, [sortBy]);

  const loadWorkouts = async () => {
    setLoading(true);
    try {
      const data = await discoverWorkouts('public', sortBy, 50);
      setWorkouts(data);
    } catch (error: any) {
      showToast('Failed to load workouts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (workout: SharedWorkout) => {
    try {
      await cloneWorkout(workout.id);
      showToast(`Cloned "${workout.name}" to your library!`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Discover Workouts
          </h1>
          <p className="text-slate-400 mt-2">Browse and clone highly-rated workouts from the community</p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm text-slate-300">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="rating">Highest Rated</option>
            <option value="popular">Most Cloned</option>
            <option value="recent">Most Recent</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading workouts...</div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No public workouts found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workouts.map((workout) => (
              <div
                key={workout.id}
                className="bg-slate-900/80 border border-slate-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all"
              >
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-white line-clamp-2">{workout.name}</h3>
                    <WorkoutVisibilityBadge visibility={workout.visibility} />
                  </div>
                  <p className="text-sm text-slate-400">by {workout.coach_name}</p>
                </div>

                <div className="space-y-2 mb-4">
                  <WorkoutRatingStars
                    rating={workout.effectiveness_rating}
                    ratingCount={workout.rating_count}
                    size="sm"
                  />
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Copy className="w-3 h-3" />
                      {workout.clone_count} clones
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {workout.times_used} uses
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleClone(workout)}
                  className="w-full bg-linear-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Clone to My Library
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
