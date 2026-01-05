// components/squad/SessionsList.tsx
import { useState, useMemo, useEffect } from "react";
import {
  Activity,
  Clock,
  FileText,
  ChevronRight,
  ChevronDown,
  CalendarRange,
  TrendingUp,
  Plus,
  Calendar,
  Edit2,
  Trash2,
  Users,
  Sparkles,
  ClipboardList,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DateInput from "@/components/ui/DateInput";
import WorkoutMiniChart from "@/components/workout/WorkoutMiniChart";
import RateWorkoutModal from "@/components/workouts/RateWorkoutModal";
import AddEditSessionModal from "@/components/squad/sessions/AddEditSessionModal";
import CreateFromScheduleModal from "@/components/squad/sessions/CreateFromScheduleModal";
import AttendanceModal from "@/components/squad/sessions/AttendanceModal";
import PracticeNotesModal from "@/components/squad/sessions/PracticeNotesModal";
import { SelectWorkoutToAssignModal } from "@/components/workouts/SelectWorkoutToAssignModal";
import { SquadPageHeader } from "@/components/squad/SquadPageHeader";
import {
  createSessionsFromSchedules,
  type TrainingSchedule,
} from "@/services/sessionService";
import { useSessionApi } from "@/hooks/api";
import "@/styles/SessionsList.css";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useToast } from "@/contexts/ToastContext"; // if using alerts
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export type Session = {
  id: string;
  training_type: string;
  start_date: string;
  end_date: string;
  workout_id?: string | null;
  workout_template?: { name: string } | null;
};

type DateRange =
  | "all"
  | "7d"
  | "30d"
  | "month"
  | "custom"
  | "week"
  | "nextweek";

type SessionsListProps = {
  sessions: Session[];
  squadId: string;
  schedules: TrainingSchedule[];
  canManage: boolean;
  canManageAttendance: boolean;
  onRefresh?: () => void;
};

export default function SessionsList({
  sessions,
  squadId,
  schedules,
  canManage,
  canManageAttendance,
  onRefresh,
}: SessionsListProps) {
  const navigate = useNavigate();
  const { createSession, updateSession, deleteSession } = useSessionApi();

  // Load date range state from localStorage or use default
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem("sessions-date-range");
    return (saved as DateRange) || "week";
  });
  const [customStart, setCustomStart] = useState(() => {
    return localStorage.getItem("sessions-custom-start") || "";
  });
  const [customEnd, setCustomEnd] = useState(() => {
    return localStorage.getItem("sessions-custom-end") || "";
  });
  const [isLegendExpanded, setIsLegendExpanded] = useState(() => {
    const saved = localStorage.getItem("sessions-legend-expanded");
    return saved === "true";
  });

  const confirmDialog = useConfirmDialog();

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem("sessions-date-range", dateRange);
  }, [dateRange]);

  useEffect(() => {
    localStorage.setItem("sessions-custom-start", customStart);
  }, [customStart]);

  useEffect(() => {
    localStorage.setItem("sessions-custom-end", customEnd);
  }, [customEnd]);

  useEffect(() => {
    localStorage.setItem("sessions-legend-expanded", String(isLegendExpanded));
  }, [isLegendExpanded]);

  // Modal state
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [createFromScheduleModalOpen, setCreateFromScheduleModalOpen] =
    useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [practiceNotesModalOpen, setPracticeNotesModalOpen] = useState(false);
  const [practiceNotesType, setPracticeNotesType] = useState<"pre" | "post">(
    "pre"
  );
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(
    null
  );
  const [attendanceSessionDate, setAttendanceSessionDate] = useState<
    string | null
  >(null);
  const [notesSessionId, setNotesSessionId] = useState<string | null>(null);
  const [notesSessionDate, setNotesSessionDate] = useState<string | null>(null);
  
  // Rating modal state
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingSessionId, setRatingSessionId] = useState<string | null>(null);
  const [ratingWorkoutId, setRatingWorkoutId] = useState<string | null>(null);
  const [ratingWorkoutName, setRatingWorkoutName] = useState<string>('');

  // Assign workout modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSquadId, setAssignSquadId] = useState<string | null>(null);
  const [assignSession, setAssignSession] = useState<Session | null>(null);

  // Filter sessions by date range
  const filteredSessions = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (dateRange) {
      case "week":
        const day = now.getDay();
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - day + (day === 0 ? -6 : 1)
        );
        endDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate() + 6,
          23,
          59,
          59,
          999
        );
        break;
      case "nextweek":
        const currentDay = now.getDay();
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + (8 - currentDay)
        );
        endDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate() + 6,
          23,
          59,
          59,
          999
        );
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      case "custom":
        if (customStart) {
          startDate = new Date(customStart);
        }
        if (customEnd) {
          endDate = new Date(customEnd);
        }
        break;
      case "all":
      default:
        return sessions;
    }

    return sessions.filter((s) => {
      const sessionDate = new Date(s.start_date);
      if (dateRange === "custom") {
        const start = startDate || new Date(0);
        const end = endDate || new Date();
        return sessionDate >= start && sessionDate <= end;
      }
      return (
        !startDate || (sessionDate >= startDate && sessionDate <= endDate!)
      );
    });
  }, [sessions, dateRange, customStart, customEnd]);

  // Sort by most recent first
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      return (
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );
    });
  }, [filteredSessions]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalDuration = sortedSessions.reduce((sum, s) => {
      const start = new Date(s.start_date);
      const end = new Date(s.end_date);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);

    const withWorkout = sortedSessions.filter((s) => s.workout_id).length;

    return {
      total: sortedSessions.length,
      duration: Math.round(totalDuration),
      withWorkout,
      avgDuration:
        sortedSessions.length > 0
          ? Math.round(totalDuration / sortedSessions.length)
          : 0,
    };
  }, [sortedSessions]);

  const handleViewWorkout = (workoutId: string) => {
    navigate(`/workouts/${workoutId}`);
  };

  const handleAddSession = () => {
    setEditingSession(null);
    setAddEditModalOpen(true);
  };

  const handleEditSession = (session: Session) => {
    setEditingSession(session);
    setAddEditModalOpen(true);
  };

  const handleCreateFromSchedule = () => {
    setCreateFromScheduleModalOpen(true);
  };

  const handleTakeAttendance = (sessionId: string, sessionDate: string) => {
    setAttendanceSessionId(sessionId);
    setAttendanceSessionDate(sessionDate);
    setAttendanceModalOpen(true);
  };

  const handlePracticeNotes = (
    sessionId: string,
    sessionDate: string,
    type: "pre" | "post"
  ) => {
    setNotesSessionId(sessionId);
    setNotesSessionDate(sessionDate);
    setPracticeNotesType(type);
    setPracticeNotesModalOpen(true);
  };

  const handleAssignExistingWorkout = (session: Session) => {
    setAssignSquadId(squadId);
    setAssignSession(session);
    setAssignModalOpen(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = await confirmDialog.confirm({
      title: "Delete Training Session",
      message:
        "Are you sure you want to delete this session? All related workout data will be removed",
      confirmText: "Delete",
      variant: "danger", // or 'warning' or 'info'
    });

    if (!confirmed) return;

    try {
      await deleteSession(sessionId, squadId);
      // Store is automatically updated by the hook
    } catch (error) {
      // Error toast is automatically shown by the hook
      console.error("Error deleting session:", error);
    }
  };

  const handleSubmitSession = async (formData: any) => {
    try {
      const startDateTime = new Date(
        `${formData.start_date}T${formData.start_time}`
      );
      const endDateTime = new Date(`${formData.end_date}T${formData.end_time}`);

      if (editingSession) {
        // Update existing session - store is automatically updated
        await updateSession(editingSession.id, squadId, {
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          training_type: "Swim",
          workout_id: formData.workout_id,
        });
      } else {
        // Create new session - store is automatically updated
        await createSession({
          squad_id: squadId,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          training_type: "Swim",
          workout_id: formData.workout_id,
        });
      }
      // Store is automatically updated by the hook, no refresh needed
    } catch (error) {
      // Error toast is automatically shown by the hook
      console.error("Error saving session:", error);
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleCreateFromScheduleSubmit = async (
    schedules: TrainingSchedule[],
    startDate: Date,
    days: number
  ) => {
    const result = await createSessionsFromSchedules(
      schedules,
      startDate,
      days,
      squadId
    );

    // Optionally handle errors
    if (result.errors.length > 0) {
      console.warn(
        `Created ${result.created.length} sessions with ${result.errors.length} errors:`,
        result.errors
      );
    }

    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <SquadPageHeader
          title="Training Sessions"
          subtitle={`${stats.total} session${
            stats.total !== 1 ? "s" : ""
          } found in the selected period`}
          actions={
            canManage ? (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleAddSession}
                  className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold text-sm hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
                >
                  <Plus size={18} />
                  Add Session
                </button>
                <button
                  onClick={handleCreateFromSchedule}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 text-cyan-400 rounded-xl font-semibold text-sm hover:bg-cyan-500/10 hover:scale-105 transition-all duration-200"
                >
                  <Calendar size={18} />
                  Create from Schedule
                </button>
              </div>
            ) : undefined
          }
        />

        {/* Date Range Filter - Compact Style */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-slate-800/40 shadow-lg">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Period:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "week" as const, label: "This Week" },
                { key: "nextweek" as const, label: "Next Week" },
                { key: "7d" as const, label: "Last 7 Days" },
                { key: "30d" as const, label: "Last 30 Days" },
                { key: "month" as const, label: "This Month" },
                { key: "all" as const, label: "All Time" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`group px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95 ${
                    dateRange === key
                      ? "bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-500/50"
                      : "bg-slate-800/80 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 hover:shadow-md border border-slate-700/40 hover:border-cyan-500/30"
                  }`}
                  onClick={() => setDateRange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-slate-800/40 shadow-lg">
              <DateInput
                label=""
                value={customStart}
                onChange={(value) => setCustomStart(value)}
                placeholder="Start"
              />
              <span className="text-slate-500 font-medium text-sm">→</span>
              <DateInput
                label=""
                value={customEnd}
                onChange={(value) => setCustomEnd(value)}
                placeholder="End"
              />
            </div>
          )}
        </div>

        {/* Stats Overview */}
        {sortedSessions.length > 0 && (
          <div className="sessions-stats">
            <div className="stat-card">
              <div className="stat-icon">
                <Activity size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total Sessions</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Clock size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.duration}</div>
                <div className="stat-label">Total Minutes</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <TrendingUp size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.avgDuration}</div>
                <div className="stat-label">Avg Duration (min)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <FileText size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.withWorkout}</div>
                <div className="stat-label">With Workout</div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Workout Color Guide */}
        {sortedSessions.length > 0 && (
          <div className="mb-6 mt-6">
            <button
              onClick={() => setIsLegendExpanded(!isLegendExpanded)}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 hover:border-slate-700/50 transition-colors duration-200 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-slate-400 font-medium ml-1">
                  Chart Colors
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 ${
                  isLegendExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {isLegendExpanded && (
              <div className="mt-3 p-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-lg">
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium mb-3">
                      Strokes
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#22D3EE" }}
                        ></div>
                        <span className="text-slate-500">Freestyle</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#8B5CF6" }}
                        ></div>
                        <span className="text-slate-500">Backstroke</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#10B981" }}
                        ></div>
                        <span className="text-slate-500">Breaststroke</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#F59E0B" }}
                        ></div>
                        <span className="text-slate-500">Butterfly</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#EF4444" }}
                        ></div>
                        <span className="text-slate-500">IM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#6B7280" }}
                        ></div>
                        <span className="text-slate-500">Choice</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium mb-3">
                      Activities
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#22D3EE" }}
                        ></div>
                        <span className="text-slate-500">Swim</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#EF4444" }}
                        ></div>
                        <span className="text-slate-500">Kick</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#10B981" }}
                        ></div>
                        <span className="text-slate-500">Pull</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: "#F59E0B" }}
                        ></div>
                        <span className="text-slate-500">Drill</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sessions List */}
        {sortedSessions.length === 0 ? (
          <div className="sessions-empty">
            <div className="empty-icon">
              <Activity size={48} />
            </div>
            <h3 className="empty-title">No sessions found</h3>
            <p className="empty-text">
              {dateRange === "all"
                ? "No training sessions have been recorded yet."
                : "No training sessions found in the selected date range. Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="sessions-grid">
            {sortedSessions.map((s) => {
              const startDate = new Date(s.start_date);
              const endDate = new Date(s.end_date);
              const duration = Math.round(
                (endDate.getTime() - startDate.getTime()) / (1000 * 60)
              );
              const isUpcoming = startDate > new Date();

              return (
                <div
                  key={s.id}
                  className="group bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 rounded-xl overflow-hidden hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300"
                >
                  {/* Compact Header */}
                  <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-700/30">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Date and Time */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-center px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg shrink-0">
                          <span className="text-xs font-bold text-cyan-400 uppercase">
                            {startDate.toLocaleDateString(undefined, { month: "short" })}
                          </span>
                          <span className="text-xl font-bold text-slate-100">
                            {startDate.getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-200 mb-1 truncate">
                            {startDate.toLocaleDateString(undefined, { weekday: "long" })}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock size={12} />
                            <span>
                              {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" - "}
                              {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              <span className="text-slate-500 ml-1">({duration} min)</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Badges */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/30 rounded-md">
                          <span className="text-xs font-bold text-cyan-400">
                            {s.training_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Workout Name Badge (if exists) */}
                    {s.workout_template?.name && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-700/30">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg w-fit">
                          <FileText size={14} className="text-purple-400" />
                          <span className="text-sm font-medium text-purple-300">
                            {s.workout_template.name}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Body - Workout Content */}
                  <div className="p-4">
                    {s.workout_id ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Workout Preview
                          </span>
                          <div className="flex items-center gap-2">
                            {!isUpcoming && (
                              <button
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-500/50 text-yellow-400 rounded-md transition-all duration-200 text-xs font-medium"
                                onClick={() => {
                                  setRatingSessionId(s.id);
                                  setRatingWorkoutId(s.workout_id!);
                                  setRatingWorkoutName(s.workout_template?.name || 'Workout');
                                  setRatingModalOpen(true);
                                }}
                              >
                                <Star size={13} />
                                <span>Rate</span>
                              </button>
                            )}
                            <button
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 rounded-md transition-all duration-200 text-xs font-medium group/btn"
                              onClick={() => handleViewWorkout(s.workout_id!)}
                            >
                              <span>View Full</span>
                              <ChevronRight
                                size={13}
                                className="group-hover/btn:translate-x-0.5 transition-transform"
                              />
                            </button>
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40 min-h-[240px]">
                          <WorkoutMiniChart workoutId={s.workout_id} />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800/30 border border-dashed border-slate-700/50 rounded-lg p-5 text-center min-h-[180px] flex flex-col items-center justify-center">
                        <FileText size={28} className="inline-block text-slate-600 mb-2" />
                        <p className="text-sm font-medium text-slate-400 mb-1">
                          No workout assigned
                        </p>
                        <p className="text-xs text-slate-500 mb-3">
                          Add a workout to track training details
                        </p>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 rounded-md transition-all duration-200 text-xs font-medium"
                              onClick={() => navigate(`/workouts/create?sessionId=${s.id}`)}
                            >
                              <Plus size={14} />
                              <span>Create Workout</span>
                            </button>
                            <button
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 text-purple-400 rounded-md transition-all duration-200 text-xs font-medium"
                              onClick={() => handleAssignExistingWorkout(s)}
                            >
                              <Calendar size={14} />
                              <span>Assign Existing</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer - Quick Actions */}
                  {(canManage || canManageAttendance) && (
                    <div className="border-t border-slate-700/30 px-4 py-2.5 bg-slate-800/20">
                      <div className="flex items-center gap-1.5 justify-end">
                        {canManage && (
                          <>
                            <button
                              className="p-1.5 hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 rounded-md transition-all duration-200"
                              onClick={() => handlePracticeNotes(s.id, s.start_date, "pre")}
                              title="Pre-practice notes"
                            >
                              <ClipboardList size={15} />
                            </button>
                            <button
                              className="p-1.5 hover:bg-purple-500/15 text-slate-500 hover:text-purple-400 rounded-md transition-all duration-200"
                              onClick={() => handlePracticeNotes(s.id, s.start_date, "post")}
                              title="Post-practice notes"
                            >
                              <Sparkles size={15} />
                            </button>
                          </>
                        )}
                        {canManageAttendance && (
                          <button
                            className="p-1.5 hover:bg-cyan-500/15 text-slate-500 hover:text-cyan-400 rounded-md transition-all duration-200"
                            onClick={() => handleTakeAttendance(s.id, s.start_date)}
                            title="Take attendance"
                          >
                            <Users size={15} />
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              className="p-1.5 hover:bg-cyan-500/15 text-slate-500 hover:text-cyan-400 rounded-md transition-all duration-200"
                              onClick={() => handleEditSession(s)}
                              title="Edit session"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="p-1.5 hover:bg-red-500/15 text-slate-500 hover:text-red-400 rounded-md transition-all duration-200"
                              onClick={() => handleDeleteSession(s.id)}
                              title="Delete session"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Session Modal */}
      <AddEditSessionModal
        open={addEditModalOpen}
        onClose={() => {
          setAddEditModalOpen(false);
          setEditingSession(null);
        }}
        squadId={squadId}
        sessionId={editingSession?.id}
        initialData={
          editingSession
            ? {
                start_date: editingSession.start_date,
                start_time: new Date(editingSession.start_date)
                  .toTimeString()
                  .slice(0, 5),
                end_date: editingSession.end_date,
                end_time: new Date(editingSession.end_date)
                  .toTimeString()
                  .slice(0, 5),
                training_type: editingSession.training_type,
                workout_id: editingSession.workout_id,
              }
            : undefined
        }
        onSubmit={handleSubmitSession}
        onSuccess={() => {
          setAddEditModalOpen(false);
          setEditingSession(null);
        }}
      />

      {/* Create from Schedule Modal */}
      <CreateFromScheduleModal
        open={createFromScheduleModalOpen}
        onClose={() => setCreateFromScheduleModalOpen(false)}
        squadId={squadId}
        schedules={schedules}
        onCreateBulkSessions={handleCreateFromScheduleSubmit}
        onSuccess={() => setCreateFromScheduleModalOpen(false)}
      />

      {/* Attendance Modal */}
      <AttendanceModal
        open={attendanceModalOpen}
        onClose={() => {
          setAttendanceModalOpen(false);
          setAttendanceSessionId(null);
          setAttendanceSessionDate(null);
        }}
        sessionId={attendanceSessionId || ""}
        squadId={squadId}
        sessionDate={attendanceSessionDate || undefined}
        onSuccess={() => {
          setAttendanceModalOpen(false);
          setAttendanceSessionId(null);
          setAttendanceSessionDate(null);
          if (onRefresh) {
            onRefresh();
          }
        }}
      />

      {/* Practice Notes Modal */}
      <PracticeNotesModal
        open={practiceNotesModalOpen}
        onClose={() => {
          setPracticeNotesModalOpen(false);
          setNotesSessionId(null);
          setNotesSessionDate(null);
        }}
        sessionId={notesSessionId || ""}
        sessionDate={notesSessionDate || ""}
        noteType={practiceNotesType}
      />

      {/* Rate Workout Modal */}
      <RateWorkoutModal
        isOpen={ratingModalOpen}
        onClose={() => {
          setRatingModalOpen(false);
          setRatingSessionId(null);
          setRatingWorkoutId(null);
          setRatingWorkoutName('');
        }}
        sessionId={ratingSessionId || ""}
        workoutId={ratingWorkoutId || ""}
        workoutName={ratingWorkoutName}
        onRatingSubmitted={() => {
          setRatingModalOpen(false);
          setRatingSessionId(null);
          setRatingWorkoutId(null);
          setRatingWorkoutName('');
          if (onRefresh) {
            onRefresh();
          }
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.handleCancel}
        onConfirm={confirmDialog.handleConfirm}
        title={confirmDialog.options.title}
        message={confirmDialog.options.message}
        confirmText={confirmDialog.options.confirmText}
        cancelText={confirmDialog.options.cancelText}
        variant={confirmDialog.options.variant}
      />

      {/* Assign Workout to Session Modal */}
      {assignModalOpen && assignSquadId && (
        <SelectWorkoutToAssignModal
          squadId={assignSquadId}
          session={assignSession || undefined}
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setAssignSquadId(null);
            setAssignSession(null);
          }}
          onAssigned={() => {
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}
    </>
  );
}
