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

// Helper to convert new versioned format to old ParsedWorkout format
function normalizeJsonDescription(jsonDesc: any): { estimate: any } | null {
  if (!jsonDesc) return null;
  
  // Check if it's the new versioned format
  if ('version' in jsonDesc && 'analysis' in jsonDesc) {
    const analysis = jsonDesc.analysis;
    return {
      estimate: {
        totalDistance: analysis.total_meters,
        totalMinutes: analysis.estimated_duration_minutes,
        estimatedCalories: analysis.estimated_calories,
        difficulty: analysis.classification?.toLowerCase() || 'moderate',
        strokeBreakdown: {
          freestyle: analysis.stroke_breakdown?.freestyle || 0,
          backstroke: analysis.stroke_breakdown?.backstroke || 0,
          breaststroke: analysis.stroke_breakdown?.breaststroke || 0,
          butterfly: analysis.stroke_breakdown?.butterfly || 0,
          individualMedley: analysis.stroke_breakdown?.IM || analysis.stroke_breakdown?.im || analysis.stroke_breakdown?.individualMedley || 0,
          choice: analysis.stroke_breakdown?.choice || 0
        },
        activityBreakdown: {
          swim: analysis.activity_breakdown?.swim || 0,
          kick: analysis.activity_breakdown?.kick || 0,
          pull: analysis.activity_breakdown?.pull || 0,
          drill: analysis.activity_breakdown?.drill || 0
        }
      }
    };
  }
  
  // Already in old format
  if ('estimate' in jsonDesc) {
    return jsonDesc;
  }
  
  return null;
}

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
    
    // Scroll to top when page loads
    window.scrollTo({ top: 0, behavior: 'instant' });
    
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
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg font-medium">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <Activity size={48} className="text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-100 mb-2">Error Loading Workout</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
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
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-slate-900/90 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity size={40} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-100 mb-2">Workout not found</h3>
          <p className="text-slate-400 mb-6">The workout you're looking for doesn't exist or has been deleted.</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const normalized = normalizeJsonDescription(workout.jsonDescription);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Modern Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-6">
            {/* Left: Back button and title section */}
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mb-3 group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-sm font-medium">Back to Workouts</span>
              </button>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Activity size={24} className="text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-slate-100 mb-2">{workout.name}</h1>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Calendar size={14} />
                      {new Date(workout.createdAt).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                    {normalized?.estimate?.difficulty && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium">
                        <TrendingUp size={14} />
                        {normalized.estimate.difficulty}
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 hover:bg-cyan-500/10 border border-slate-700/50 hover:border-cyan-500/30 text-slate-400 hover:text-cyan-400 transition-all"
                title="Edit workout"
              >
                <Edit size={16} />
                <span className="text-sm font-medium">Edit</span>
              </button>
              <button 
                onClick={handleDownload}
                className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-all"
                title="Download"
              >
                <Download size={18} />
              </button>
              <button 
                onClick={handleCopy}
                className={`p-2 rounded-xl transition-all ${
                  copied 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
                title={copied ? "Copied!" : "Copy to clipboard"}
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
              </button>
              <button 
                onClick={handleDelete}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
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
        {/* Stats Grid - Minimal & Vibrant */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 p-4 hover:from-cyan-500/30 hover:to-cyan-600/20 hover:border-cyan-400/40 transition-all hover:scale-[1.02]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-400/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 transition-all" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={18} className="text-cyan-400" />
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide">Distance</span>
              </div>
              <p className="text-3xl font-black text-white mb-0.5">
                {workout.totalMeters.toLocaleString()}
              </p>
              <p className="text-xs text-cyan-200/70 font-medium">meters</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-green-500/20 to-green-600/10 border border-green-500/30 p-4 hover:from-green-500/30 hover:to-green-600/20 hover:border-green-400/40 transition-all hover:scale-[1.02]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-400/10 rounded-full blur-2xl group-hover:bg-green-400/20 transition-all" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Timer size={18} className="text-green-400" />
                <span className="text-xs font-bold text-green-300 uppercase tracking-wide">Duration</span>
              </div>
              <p className="text-3xl font-black text-white mb-0.5">
                {workout.estimatedTimeMinutes}
              </p>
              <p className="text-xs text-green-200/70 font-medium">minutes</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 p-4 hover:from-orange-500/30 hover:to-orange-600/20 hover:border-orange-400/40 transition-all hover:scale-[1.02]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-400/10 rounded-full blur-2xl group-hover:bg-orange-400/20 transition-all" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={18} className="text-orange-400" />
                <span className="text-xs font-bold text-orange-300 uppercase tracking-wide">Calories</span>
              </div>
              <p className="text-3xl font-black text-white mb-0.5">
                {workout.estimatedCalories.toLocaleString()}
              </p>
              <p className="text-xs text-orange-200/70 font-medium">kcal</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl bg-linear-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 p-4 hover:from-purple-500/30 hover:to-purple-600/20 hover:border-purple-400/40 transition-all hover:scale-[1.02]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-400/10 rounded-full blur-2xl group-hover:bg-purple-400/20 transition-all" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={18} className="text-purple-400" />
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wide">Effort</span>
              </div>
              <p className="text-3xl font-black text-white mb-0.5">
                {workout.effortLevel}<span className="text-xl text-purple-200/50">/10</span>
              </p>
              <p className="text-xs text-purple-200/70 font-medium">intensity</p>
            </div>
          </div>
        </div>

        {/* Main Content - Enhanced Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workout Analysis */}
          {normalized?.estimate && (
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 shadow-xl overflow-hidden">
              <div className="bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 px-6 py-5 border-b border-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                    <BarChart3 size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Workout Analysis</h2>
                    <p className="text-sm text-slate-400">Visual breakdown by stroke and activity type</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <WorkoutBreakdownCharts estimate={normalized.estimate} />
              </div>
            </div>
          )}

          {/* Workout Description - Enhanced Typography */}
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 shadow-xl overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="bg-linear-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 px-6 py-5 border-b border-slate-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:shadow-blue-500/20 transition-all">
                    <FileText size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">Workout Plan</h2>
                    <p className="text-sm text-slate-400">Complete training session details</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs font-bold text-blue-400">
                      {workout.rawDescription.split('\n').filter((line: string) => line.trim()).length} lines
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="relative group/content">
                {/* Decorative gradient overlay */}
                <div className="absolute -inset-4 bg-linear-to-r from-blue-500/5 via-cyan-500/5 to-teal-500/5 rounded-2xl opacity-0 group-hover/content:opacity-100 transition-opacity blur-xl" />
                
                {/* Content container */}
                <div className="relative bg-slate-800/60 rounded-xl p-6 border border-slate-700/40 backdrop-blur-sm hover:border-slate-600/60 transition-all h-[730px] overflow-y-auto">
                  {/* Line numbers and content */}
                  <div className="flex gap-4">
                    {/* Line numbers */}
                    <div className="flex flex-col text-right select-none opacity-40 group-hover/content:opacity-60 transition-opacity sticky top-0">
                      {workout.rawDescription.split('\n').map((_: string, index: number) => (
                        <div key={index} className="text-[13px] leading-[1.8] font-mono text-slate-500 tabular-nums">
                          {index + 1}
                        </div>
                      ))}
                    </div>
                    
                    {/* Separator */}
                    <div className="w-px bg-linear-to-b from-transparent via-slate-700/50 to-transparent opacity-50 group-hover/content:opacity-70 transition-opacity" />
                    
                    {/* Workout text */}
                    <div className="flex-1 text-[15px] leading-[1.8] whitespace-pre-wrap text-slate-100 font-mono tracking-tight selection:bg-cyan-500/30">
                      {workout.rawDescription}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}