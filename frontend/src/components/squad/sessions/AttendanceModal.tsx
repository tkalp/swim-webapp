// components/squad/sessions/AttendanceModal.tsx
import { useState, useEffect } from "react";
import { X, Users, CheckCircle, Clock, XCircle, Save, AlertCircle } from "lucide-react";
import {
  getSessionAttendanceWithSwimmers,
  bulkUpsertAttendance,
  type AttendanceStatus,
} from "../../../services/attendanceService";

type AttendanceModalProps = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  squadId: string;
  sessionDate?: string;
  onSuccess?: () => void;
};

type SwimmerWithAttendance = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  attendance: {
    id: string;
    status: AttendanceStatus;
    notes?: string | null;
  } | null;
};

export default function AttendanceModal({
  open,
  onClose,
  sessionId,
  squadId,
  sessionDate,
  onSuccess,
}: AttendanceModalProps) {
  const [swimmers, setSwimmers] = useState<SwimmerWithAttendance[]>([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, late: 0, absent: 0, not_recorded: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAttendance, setLocalAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [localNotes, setLocalNotes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open) {
      loadAttendance();
    }
  }, [open, sessionId, squadId]);

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionAttendanceWithSwimmers(sessionId, squadId);
      setSwimmers(data.swimmers);
      setSummary(data.summary);

      // Initialize local state from existing attendance
      const statusMap = new Map<string, AttendanceStatus>();
      const notesMap = new Map<string, string>();
      data.swimmers.forEach(swimmer => {
        if (swimmer.attendance) {
          statusMap.set(swimmer.id, swimmer.attendance.status);
          if (swimmer.attendance.notes) {
            notesMap.set(swimmer.id, swimmer.attendance.notes);
          }
        }
      });
      setLocalAttendance(statusMap);
      setLocalNotes(notesMap);
    } catch (err) {
      console.error("Error loading attendance:", err);
      setError("Failed to load attendance data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (swimmerId: string, status: AttendanceStatus) => {
    setLocalAttendance(prev => new Map(prev).set(swimmerId, status));
  };

  const handleNotesChange = (swimmerId: string, notes: string) => {
    setLocalNotes(prev => {
      const newMap = new Map(prev);
      if (notes.trim()) {
        newMap.set(swimmerId, notes);
      } else {
        newMap.delete(swimmerId);
      }
      return newMap;
    });
  };

  const handleMarkAllPresent = () => {
    const newMap = new Map(localAttendance);
    swimmers.forEach(swimmer => {
      newMap.set(swimmer.id, 'present');
    });
    setLocalAttendance(newMap);
  };

  const handleMarkRemainingAbsent = async () => {
    const newMap = new Map(localAttendance);
    swimmers.forEach(swimmer => {
      if (!localAttendance.has(swimmer.id)) {
        newMap.set(swimmer.id, 'absent');
      }
    });
    setLocalAttendance(newMap);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const records = swimmers
        .filter(swimmer => localAttendance.has(swimmer.id))
        .map(swimmer => ({
          swimmer_id: swimmer.id,
          status: localAttendance.get(swimmer.id)!,
          notes: localNotes.get(swimmer.id) || null,
        }));

      if (records.length > 0) {
        await bulkUpsertAttendance(sessionId, records);
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("Error saving attendance:", err);
      setError("Failed to save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'late':
        return <Clock className="w-5 h-5 text-warning" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-danger" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-border" />;
    }
  };

  const getStatusButtonClass = (swimmerStatus: AttendanceStatus | undefined, buttonStatus: AttendanceStatus) => {
    const isSelected = swimmerStatus === buttonStatus;
    const baseClass = "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200";
    
    if (buttonStatus === 'present') {
      return `${baseClass} ${isSelected 
        ? 'bg-success text-white shadow-md' 
        : 'bg-background-secondary text-text-secondary hover:bg-success/20 hover:text-success border border-border'}`;
    } else if (buttonStatus === 'late') {
      return `${baseClass} ${isSelected 
        ? 'bg-warning text-white shadow-md' 
        : 'bg-background-secondary text-text-secondary hover:bg-warning/20 hover:text-warning border border-border'}`;
    } else {
      return `${baseClass} ${isSelected 
        ? 'bg-danger text-white shadow-md' 
        : 'bg-background-secondary text-text-secondary hover:bg-danger/20 hover:text-danger border border-border'}`;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background-elevated rounded-xl shadow-2xl border border-border max-w-3xl w-full max-h-[75vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-linear-to-r from-primary/10 to-accent/10">
          <div>
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Take Attendance
            </h2>
            {sessionDate && (
              <p className="text-sm text-text-secondary mt-1">
                {new Date(sessionDate).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-2 hover:bg-background-secondary rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-background-secondary/50">
          <div className="text-center p-3 bg-background-elevated rounded-lg border border-border">
            <div className="text-2xl font-bold text-text-primary">{summary.total}</div>
            <div className="text-xs text-text-secondary">Total</div>
          </div>
          <div className="text-center p-3 bg-success/10 rounded-lg border border-success/30">
            <div className="text-2xl font-bold text-success">
              {swimmers.filter(s => localAttendance.get(s.id) === 'present').length}
            </div>
            <div className="text-xs text-success">Present</div>
          </div>
          <div className="text-center p-3 bg-warning/10 rounded-lg border border-warning/30">
            <div className="text-2xl font-bold text-warning">
              {swimmers.filter(s => localAttendance.get(s.id) === 'late').length}
            </div>
            <div className="text-xs text-warning">Late</div>
          </div>
          <div className="text-center p-3 bg-danger/10 rounded-lg border border-danger/30">
            <div className="text-2xl font-bold text-danger">
              {swimmers.filter(s => localAttendance.get(s.id) === 'absent').length}
            </div>
            <div className="text-xs text-danger">Absent</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 p-4 border-b border-border">
          <button
            onClick={handleMarkAllPresent}
            className="px-4 py-2 bg-success/20 text-success rounded-lg text-sm font-medium hover:bg-success/30 transition-colors border border-success/30"
          >
            Mark All Present
          </button>
          <button
            onClick={handleMarkRemainingAbsent}
            className="px-4 py-2 bg-danger/20 text-danger rounded-lg text-sm font-medium hover:bg-danger/30 transition-colors border border-danger/30"
          >
            Mark Remaining Absent
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-2 text-danger text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Swimmers List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : swimmers.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Users size={48} className="mx-auto mb-2 opacity-50" />
              <p>No swimmers found in this squad</p>
            </div>
          ) : (
            <div className="space-y-2">
              {swimmers.map(swimmer => {
                const status = localAttendance.get(swimmer.id);
                const notes = localNotes.get(swimmer.id) || '';
                
                return (
                  <div
                    key={swimmer.id}
                    className="p-4 bg-background-secondary/50 rounded-lg border border-border hover:border-border-light transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <div>
                          <div className="font-semibold text-text-primary">
                            {swimmer.first_name} {swimmer.last_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(swimmer.id, 'present')}
                          className={getStatusButtonClass(status, 'present')}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => handleStatusChange(swimmer.id, 'late')}
                          className={getStatusButtonClass(status, 'late')}
                        >
                          Late
                        </button>
                        <button
                          onClick={() => handleStatusChange(swimmer.id, 'absent')}
                          className={getStatusButtonClass(status, 'absent')}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                    
                    {/* Notes input - show only if status is set */}
                    {status && (
                      <input
                        type="text"
                        placeholder="Add notes (optional)..."
                        value={notes}
                        onChange={(e) => handleNotesChange(swimmer.id, e.target.value)}
                        className="w-full px-3 py-2 bg-background-elevated border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-background-secondary/30">
          <div className="text-sm text-text-muted">
            {swimmers.filter(s => localAttendance.has(s.id)).length} of {swimmers.length} recorded
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-background-secondary text-text-primary rounded-lg font-medium hover:bg-background-tertiary transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-linear-to-r from-primary to-accent text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Attendance
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
