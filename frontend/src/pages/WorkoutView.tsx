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
  Zap,
  FileText,
  Calendar,
  TrendingUp,
  CheckCircle,
  Tag,
} from "lucide-react";
import useWorkout from '@/hooks/useWorkout';
import { WorkoutStructuredView } from '@/components/workout/WorkoutStructuredView';
import { getWorkoutTags } from '@/services/workoutTagService';
import { deleteWorkoutTemplate } from '@/services/workoutTemplateService';
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

  const handleDelete = async () => {
    if (!workoutId) return;
    if (!window.confirm("Are you sure you want to delete this workout?")) return;
    try {
      await deleteWorkoutTemplate(workoutId);
      navigate('/workouts');
    } catch (error) {
      console.error('Error deleting workout:', error);
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

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Modern Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/60 sticky top-[60px] z-40">
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
                  {workout.description && (
                    <p className="text-slate-400 text-sm mb-3 leading-relaxed">{workout.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Calendar size={14} />
                      {new Date(workout.createdAt).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                    {workout.classification && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm font-medium capitalize">
                        <TrendingUp size={14} />
                        {workout.classification}
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
      <div className="max-w-7xl mx-auto px-6 py-6">
        <WorkoutStructuredView
          jsonDescription={workout.jsonDescription}
          rawDescription={workout.rawDescription}
          description={workout.description}
        />
      </div>
    </div>
  );
}