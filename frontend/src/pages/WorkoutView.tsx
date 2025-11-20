// pages/WorkoutViewPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Download,
  Copy,
  Activity,
  Target,
  Zap,
  FileText,
  Calendar,
  TrendingUp,
  Timer,
  BarChart3,
  Flame,
  CheckCircle,
  Tag,
} from "lucide-react";
import useWorkout from '@/hooks/useWorkout';
import WorkoutBreakdownCharts from '@/components/workout/WorkoutBreakdownCharts';
import { getWorkoutTags } from '@/services/workoutTagService';
import type { WorkoutTag } from '@/types/workoutTags';

export default function WorkoutViewPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<any | null>(null);
  const [tags, setTags] = useState<WorkoutTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { fetchWorkout, workoutLoading } = useWorkout();

  useEffect(() => {
    if (!workoutId) return;
    let mounted = true;
    setLoading(true);
    
    Promise.all([
      fetchWorkout(workoutId),
      getWorkoutTags(workoutId)
    ])
      .then(([workoutData, tagsData]) => {
        if (mounted) {
          setWorkout(workoutData);
          setTags(tagsData);
        }
      })
      .catch((e) => {
        if (mounted) setError(e.message ?? "Failed to load workout");
      })
      .finally(() => mounted && setLoading(false));
    
    return () => {
      mounted = false;
    };
  }, [workoutId]);

  const handleEdit = () => {
    if (workoutId) navigate(`/workouts/${workoutId}/edit`);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this workout?")) {
      console.log("Delete workout:", workoutId);
      navigate(-1);
    }
  };

  const handleDownload = () => {
    if (!workout) return;

    const content = `${workout.name}\n\nCreated: ${new Date(
      workout.createdAt
    ).toLocaleDateString()}\nDistance: ${workout.totalMeters}m\nDuration: ${
      workout.estimatedTimeMinutes
    } min\nCalories: ${workout.estimatedCalories}\nEffort: ${
      workout.effortLevel
    }/10\n\n${workout.rawDescription}`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workout.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!workout) return;
    navigator.clipboard.writeText(workout.rawDescription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || workoutLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-danger/10 border border-danger/30 rounded-xl p-6 text-center">
          <Activity size={48} className="text-danger mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text-primary mb-2">Error Loading Workout</h3>
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-background-card rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity size={40} className="text-text-secondary" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">Workout not found</h3>
          <p className="text-text-secondary mb-6">The workout you're looking for doesn't exist or has been deleted.</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      {/* Modern Header */}
      <div className="bg-background-elevated/80 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-6">
            {/* Left: Back button and title section */}
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors mb-3 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-sm font-medium">Back to Workouts</span>
              </button>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <Activity size={24} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-text-primary mb-2">{workout.name}</h1>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Calendar size={14} />
                      {new Date(workout.createdAt).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                    {workout.jsonDescription?.estimate?.difficulty && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium">
                        <TrendingUp size={14} />
                        {workout.jsonDescription.estimate.difficulty}
                      </span>
                    )}
                    {tags.length > 0 && (
                      <div className="flex items-center gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                              border: `1px solid ${tag.color}40`
                            }}
                          >
                            <Tag size={12} />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-background-tertiary hover:bg-primary/10 border border-border hover:border-primary/30 text-text-secondary hover:text-primary transition-all"
                title="Edit workout"
              >
                <Edit size={16} />
                <span className="text-sm font-medium">Edit</span>
              </button>
              <button 
                onClick={handleDownload}
                className="p-2 rounded-xl bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary transition-all"
                title="Download"
              >
                <Download size={18} />
              </button>
              <button 
                onClick={handleCopy}
                className={`p-2 rounded-xl transition-all ${
                  copied 
                    ? 'bg-success/20 text-success' 
                    : 'bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary'
                }`}
                title={copied ? "Copied!" : "Copy to clipboard"}
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
              </button>
              <button 
                onClick={handleDelete}
                className="p-2 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger transition-all"
                title="Delete workout"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm rounded-2xl p-5 border border-border/60 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity size={20} className="text-cyan-400" />
              </div>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Distance</span>
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">
              {workout.totalMeters.toLocaleString()}
            </p>
            <p className="text-xs text-text-secondary">meters</p>
          </div>

          <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm rounded-2xl p-5 border border-border/60 hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/10 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Timer size={20} className="text-green-400" />
              </div>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Duration</span>
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">
              {workout.estimatedTimeMinutes}
            </p>
            <p className="text-xs text-text-secondary">minutes</p>
          </div>

          <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm rounded-2xl p-5 border border-border/60 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame size={20} className="text-orange-400" />
              </div>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Calories</span>
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">
              {workout.estimatedCalories.toLocaleString()}
            </p>
            <p className="text-xs text-text-secondary">kcal</p>
          </div>

          <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm rounded-2xl p-5 border border-border/60 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap size={20} className="text-purple-400" />
              </div>
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Effort</span>
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">
              {workout.effortLevel}/10
            </p>
            <p className="text-xs text-text-secondary">intensity</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workout Description */}
          <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm rounded-2xl p-6 border border-border/60 shadow-xl">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/40">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <FileText size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Workout Plan</h2>
                <p className="text-xs text-text-secondary">Complete training session details</p>
              </div>
            </div>
            <div className="bg-background-tertiary/30 rounded-xl p-5 border border-border/30 max-h-[600px] overflow-y-auto">
              <div className="prose prose-sm max-w-none">
                <div className="text-base leading-loose whitespace-pre-wrap text-text-primary">
                  {workout.rawDescription}
                </div>
              </div>
            </div>
          </div>

          {/* Workout Analysis */}
          {workout.jsonDescription?.estimate && (
            <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm rounded-2xl p-6 border border-border/60 shadow-xl">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/40">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                  <BarChart3 size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Workout Analysis</h2>
                  <p className="text-xs text-text-secondary">Breakdown by stroke and activity</p>
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                <WorkoutBreakdownCharts estimate={workout.jsonDescription.estimate} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}