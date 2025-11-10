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
  Waves,
  Timer,
  BarChart3,
  Flame,
  CheckCircle,
} from "lucide-react";
import useWorkout from "../hooks/useWorkout";
import WorkoutBreakdownCharts from "../components/workout/WorkoutBreakdownCharts";

export default function WorkoutViewPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { fetchWorkout, workoutLoading } = useWorkout();

  useEffect(() => {
    if (!workoutId) return;
    let mounted = true;
    setLoading(true);
    fetchWorkout(workoutId)
      .then((data) => {
        if (mounted) {
          setWorkout(data);
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
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <div className="bg-background-elevated border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors shrink-0"
              >
                <ArrowLeft size={16} />
                <span className="text-sm">Back</span>
              </button>
              
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Activity size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-text-primary truncate">{workout.name}</h1>
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={11} />
                      {new Date(workout.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                    {workout.jsonDescription?.estimate?.difficulty && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                        <TrendingUp size={11} />
                        {workout.jsonDescription.estimate.difficulty}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={handleEdit}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary transition-colors"
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={handleDownload}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary transition-colors"
                title="Download"
              >
                <Download size={16} />
              </button>
              <button 
                onClick={handleCopy}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  copied 
                    ? 'bg-success/20 text-success' 
                    : 'bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary'
                }`}
                title={copied ? "Copied!" : "Copy"}
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              </button>
              <button 
                onClick={handleDelete}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Fixed Height Layout */}
      <div className="h-[calc(100vh-73px)] overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-6 py-4 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-background-card rounded-lg p-3 border border-border hover:shadow-lg hover:shadow-primary/5 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <Waves size={16} className="text-cyan-400" />
                  </div>
                  <span className="text-xs font-medium text-text-secondary">Total Distance</span>
                </div>
                <p className="text-xl font-bold text-text-primary">
                  {workout.totalMeters.toLocaleString()}
                  <span className="text-xs font-normal text-text-secondary ml-1">m</span>
                </p>
              </div>

              <div className="bg-background-card rounded-lg p-3 border border-border hover:shadow-lg hover:shadow-green-500/5 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <Timer size={16} className="text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-text-secondary">Est. Duration</span>
                </div>
                <p className="text-xl font-bold text-text-primary">
                  {workout.estimatedTimeMinutes}
                  <span className="text-xs font-normal text-text-secondary ml-1">min</span>
                </p>
              </div>

              <div className="bg-background-card rounded-lg p-3 border border-border hover:shadow-lg hover:shadow-orange-500/5 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                    <Flame size={16} className="text-orange-400" />
                  </div>
                  <span className="text-xs font-medium text-text-secondary">Est. Calories</span>
                </div>
                <p className="text-xl font-bold text-text-primary">
                  {workout.estimatedCalories.toLocaleString()}
                  <span className="text-xs font-normal text-text-secondary ml-1">kcal</span>
                </p>
              </div>

              <div className="bg-background-card rounded-lg p-3 border border-border hover:shadow-lg hover:shadow-purple-500/5 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Zap size={16} className="text-purple-400" />
                  </div>
                  <span className="text-xs font-medium text-text-secondary">Effort Level</span>
                </div>
                <p className="text-xl font-bold text-text-primary">
                  {workout.effortLevel}
                  <span className="text-xs font-normal text-text-secondary ml-1">/10</span>
                </p>
              </div>
            </div>

            {/* Side by Side Layout */}
            <div className="flex gap-4 h-[calc(100vh-220px)]">
              {/* Workout Description - Left Side */}
              <div className="flex-1 bg-background-card rounded-lg p-4 border border-border flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <FileText size={16} className="text-blue-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-text-primary">Workout Plan</h2>
                </div>
                <div className="font-mono text-sm space-y-0.5 overflow-y-auto flex-1">
                  {workout.rawDescription
                    .split("\n")
                    .map((line: string, index: number) => (
                      <p key={index} className={line ? "text-text-primary" : "text-text-tertiary"}>
                        {line || "\u00A0"}
                      </p>
                    ))}
                </div>
              </div>

              {/* Workout Analysis Charts - Right Side */}
              {workout.jsonDescription?.estimate && (
                <div className="flex-1 bg-background-card rounded-lg p-4 border border-border flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                      <BarChart3 size={16} className="text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">Workout Analysis</h2>
                      <p className="text-xs text-text-secondary">Distance breakdown by stroke and activity</p>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    <WorkoutBreakdownCharts estimate={workout.jsonDescription.estimate} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}