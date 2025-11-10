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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DateInput from "../ui/DateInput";
import WorkoutMiniChart from "../workout/WorkoutMiniChart";
import AddEditSessionModal from "./sessions/AddEditSessionModal";
import CreateFromScheduleModal from "./sessions/CreateFromScheduleModal";
import AttendanceModal from "./sessions/AttendanceModal";
import { createSession, updateSession, createSessionsFromSchedules, deleteSession, type TrainingSchedule } from "../../services/sessionService";
import "@/styles/SessionsList.css";

type Session = {
  id: string;
  training_type: string;
  start_date: string;
  end_date: string;
  workout_id?: string | null;
};

type DateRange = "all" | "7d" | "30d" | "month" | "custom" | "week" | "nextweek";

type SessionsListProps = {
  sessions: Session[];
  squadId: string;
  schedules: TrainingSchedule[];
  onRefresh?: () => void;
};

export default function SessionsList({ sessions, squadId, schedules, onRefresh }: SessionsListProps) {
  const navigate = useNavigate();
  
  // Load date range state from localStorage or use default
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem('sessions-date-range');
    return (saved as DateRange) || "week";
  });
  const [customStart, setCustomStart] = useState(() => {
    return localStorage.getItem('sessions-custom-start') || "";
  });
  const [customEnd, setCustomEnd] = useState(() => {
    return localStorage.getItem('sessions-custom-end') || "";
  });
  const [isLegendExpanded, setIsLegendExpanded] = useState(() => {
    const saved = localStorage.getItem('sessions-legend-expanded');
    return saved === 'true';
  });

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('sessions-date-range', dateRange);
  }, [dateRange]);

  useEffect(() => {
    localStorage.setItem('sessions-custom-start', customStart);
  }, [customStart]);

  useEffect(() => {
    localStorage.setItem('sessions-custom-end', customEnd);
  }, [customEnd]);

  useEffect(() => {
    localStorage.setItem('sessions-legend-expanded', String(isLegendExpanded));
  }, [isLegendExpanded]);

  // Modal state
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [createFromScheduleModalOpen, setCreateFromScheduleModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);
  const [attendanceSessionDate, setAttendanceSessionDate] = useState<string | null>(null);

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
      return !startDate || (sessionDate >= startDate && sessionDate <= endDate!);
    });
  }, [sessions, dateRange, customStart, customEnd]);

  // Sort by most recent first
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
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

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this training session?')) {
      return;
    }

    try {
      await deleteSession(sessionId);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  const handleSubmitSession = async (formData: any) => {
    try {
      const startDateTime = new Date(`${formData.start_date}T${formData.start_time}`);
      const endDateTime = new Date(`${formData.end_date}T${formData.end_time}`);

      if (editingSession) {
        // Update existing session
        await updateSession(editingSession.id, {
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          training_type: "Swim",
          workout_id: formData.workout_id,
        });
      } else {
        // Create new session
        await createSession({
          squad_id: squadId,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          training_type: "Swim",
          workout_id: formData.workout_id,
        });
      }

      // Trigger refresh after successful create/update
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error saving session:', error);
      throw error; // Re-throw so modal can handle it
    }
  };

  const handleCreateFromScheduleSubmit = async (schedules: TrainingSchedule[], startDate: Date, days: number) => {
    const result = await createSessionsFromSchedules(schedules, startDate, days, squadId);
    
    // Optionally handle errors
    if (result.errors.length > 0) {
      console.warn(`Created ${result.created.length} sessions with ${result.errors.length} errors:`, result.errors);
    }
    
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
    <div className="sessions-list-container">
      {/* Date Range Toolbar - Modern Style */}
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center shadow-md shadow-accent/25">
            <CalendarRange className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Date Range</h3>
            <p className="text-xs text-text-tertiary">Select a time period</p>
          </div>
        </div>

        {/* Quick Preset Buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
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
              className={`group px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 hover:scale-105 active:scale-95 ${
                dateRange === key
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30 ring-2 ring-primary/50"
                  : "bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary hover:shadow-sm border border-border/30"
              }`}
              onClick={() => setDateRange(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <div className="flex flex-wrap items-end gap-3 p-3 bg-background-tertiary/30 rounded-lg border border-border/30">
          <div className="flex-1 min-w-[150px]">
            <DateInput
              label="From Date"
              value={customStart}
              onChange={(value) => {
                setCustomStart(value);
                setDateRange("custom");
              }}
              placeholder="Select start date"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <DateInput
              label="To Date"
              value={customEnd}
              onChange={(value) => {
                setCustomEnd(value);
                setDateRange("custom");
              }}
              placeholder="Select end date"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={handleAddSession}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg font-semibold text-sm hover:scale-105 hover:shadow-lg hover:shadow-primary/25 transition-all duration-200"
        >
          <Plus size={18} />
          Add Session
        </button>
        <button
          onClick={handleCreateFromSchedule}
          className="flex items-center gap-2 px-4 py-2.5 bg-background-elevated border border-primary/30 text-primary rounded-lg font-semibold text-sm hover:bg-primary/10 hover:scale-105 transition-all duration-200"
        >
          <Calendar size={18} />
          Create from Schedule
        </button>
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
        <div className="mb-4">
          <button
            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
            className="flex items-center gap-3 p-2 rounded-lg bg-background-elevated border border-border hover:border-border-light transition-colors duration-200 text-xs"
          >
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <div className="w-2 h-2 bg-accent-purple rounded-full"></div>
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <div className="w-2 h-2 bg-warning rounded-full"></div>
              <div className="w-2 h-2 bg-danger rounded-full"></div>
              <span className="text-text-secondary font-medium">Chart Colors</span>
            </div>
            <ChevronDown 
              size={14} 
              className={`text-text-muted transition-transform duration-200 ${
                isLegendExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          
          {isLegendExpanded && (
            <div className="mt-2 p-3 bg-background-elevated border border-border rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-text-secondary font-medium mb-2">Strokes</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#22D3EE' }}></div>
                      <span className="text-text-muted">Freestyle</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#8B5CF6' }}></div>
                      <span className="text-text-muted">Backstroke</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#10B981' }}></div>
                      <span className="text-text-muted">Breaststroke</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#F59E0B' }}></div>
                      <span className="text-text-muted">Butterfly</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#EF4444' }}></div>
                      <span className="text-text-muted">IM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#6B7280' }}></div>
                      <span className="text-text-muted">Choice</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-text-secondary font-medium mb-2">Activities</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#22D3EE' }}></div>
                      <span className="text-text-muted">Swim</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#EF4444' }}></div>
                      <span className="text-text-muted">Kick</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#10B981' }}></div>
                      <span className="text-text-muted">Pull</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#F59E0B' }}></div>
                      <span className="text-text-muted">Drill</span>
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

            return (
              <div key={s.id} className="session-card">
                <div className="session-header">
                  <div className="session-type-badge">{s.training_type}</div>
                  <div className="session-duration">
                    <Clock size={14} />
                    <span>{duration} min</span>
                  </div>
                </div>

                <div className="session-body">
                  <div className="session-info-row">
                    <Activity size={18} className="session-icon" />
                    <div className="session-info">
                      <div className="session-date">
                        {startDate.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="session-time">
                        {startDate.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" → "}
                        {endDate.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {/* Workout Breakdown Mini Chart */}
                  {s.workout_id ? (
                    <div className="session-workout-breakdown">
                      <WorkoutMiniChart workoutId={s.workout_id} />
                    </div>
                  ) : (
                    <div className="mt-3 p-4 bg-background-tertiary/30 border border-dashed border-border/40 rounded-lg text-center">
                      <FileText size={20} className="inline-block text-text-tertiary mb-1" />
                      <p className="text-sm text-text-tertiary">No workout assigned yet</p>
                      <p className="text-xs text-text-tertiary/70 mt-1">Create a workout to add training details</p>
                    </div>
                  )}
                </div>

                <div className="session-footer">
                  <div className="flex gap-2 w-full">
                    {s.workout_id ? (
                      <button
                        className="session-workout-btn flex-1"
                        onClick={() => handleViewWorkout(s.workout_id!)}
                      >
                        <FileText size={16} />
                        <span>View Workout</span>
                        <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="session-create-workout-btn flex-1"
                        onClick={() =>
                          navigate(`/workouts/create?sessionId=${s.id}`)
                        }
                      >
                        <Plus size={16} />
                        <span>Create Workout</span>
                      </button>
                    )}
                    <button
                      className="px-3 py-2 bg-background-secondary/80 border border-border/30 text-text-secondary hover:text-accent hover:bg-accent/10 hover:border-accent/50 rounded-lg transition-all duration-200"
                      onClick={() => handleTakeAttendance(s.id, s.start_date)}
                      title="Take attendance"
                    >
                      <Users size={16} />
                    </button>
                    <button
                      className="px-3 py-2 bg-background-secondary/80 border border-border/30 text-text-secondary hover:text-primary hover:bg-primary/10 hover:border-primary/50 rounded-lg transition-all duration-200"
                      onClick={() => handleEditSession(s)}
                      title="Edit session"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="px-3 py-2 bg-background-secondary/80 border border-border/30 text-text-secondary hover:text-danger hover:bg-danger/10 hover:border-danger/50 rounded-lg transition-all duration-200"
                      onClick={() => handleDeleteSession(s.id)}
                      title="Delete session"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
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
      initialData={editingSession ? {
        start_date: editingSession.start_date,
        start_time: new Date(editingSession.start_date).toTimeString().slice(0, 5),
        end_date: editingSession.end_date,
        end_time: new Date(editingSession.end_date).toTimeString().slice(0, 5),
        training_type: editingSession.training_type,
        workout_id: editingSession.workout_id,
      } : undefined}
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
      sessionId={attendanceSessionId || ''}
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
    </>
  );
}