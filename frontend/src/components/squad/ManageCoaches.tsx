// components/squad/ManageCoaches.tsx
import { useState, useEffect } from 'react';
import { UserPlus, Shield, Trash2, Mail, Check, X, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  getSquadCoaches,
  updateCoachPermissions,
  removeCoachFromSquad,
  DEFAULT_PERMISSIONS,
  type CoachSquadMembership,
  type SquadPermissions,
} from '../../hooks/useSquadPermissions';

interface Coach {
  id: string;
  first_name: string;
  last_name: string;
}

interface Connection {
  id: string;
  requester_id: string;
  recipient_id: string;
  coach?: Coach;
}

interface ManageCoachesProps {
  squadId: string;
  canManage: boolean;
}

export function ManageCoaches({ squadId, canManage }: ManageCoachesProps) {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState<CoachSquadMembership[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCoaches();
    if (canManage) {
      loadConnections();
    }
  }, [squadId, canManage]);

  const loadConnections = async () => {
    if (!user?.id) return;

    try {
      // Get all accepted connections
      const { data: connectionsData, error: connError } = await supabase
        .from('coach_connections')
        .select('*')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (connError) throw connError;

      // Get coach IDs
      const coachIds = connectionsData?.map(conn => 
        conn.requester_id === user.id ? conn.recipient_id : conn.requester_id
      ) || [];

      if (coachIds.length === 0) {
        setConnections([]);
        return;
      }

      // Fetch coach details
      const { data: coachesData } = await supabase
        .from('coach')
        .select('id, first_name, last_name')
        .in('id', coachIds);

      const coachMap = new Map(coachesData?.map(c => [c.id, c]) || []);

      const connectionsWithCoaches = connectionsData?.map(conn => {
        const coachId = conn.requester_id === user.id ? conn.recipient_id : conn.requester_id;
        return {
          ...conn,
          coach: coachMap.get(coachId),
        };
      }) || [];

      setConnections(connectionsWithCoaches);
    } catch (err: any) {
      console.error('Error loading connections:', err);
    }
  };

  const loadCoaches = async () => {
    try {
      setLoading(true);
      const data = await getSquadCoaches(squadId);
      setCoaches(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedCoachId) return;

    try {
      setError('');

      // Check if coach is already in squad
      const isAlreadyMember = coaches.some(c => c.coach_id === selectedCoachId);
      if (isAlreadyMember) {
        setError('This coach is already a member of this squad');
        return;
      }

      // Add coach to squad
      const { error: insertError } = await supabase
        .from('coach_squads')
        .insert({
          squad_id: squadId,
          coach_id: selectedCoachId,
          role: selectedRole,
          created_by: user.id,
          ...DEFAULT_PERMISSIONS[selectedRole],
        });

      if (insertError) throw insertError;

      setShowAdd(false);
      setSelectedCoachId('');
      setSelectedRole('member');
      await loadCoaches();
      await loadConnections();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveCoach = async (membershipId: string, coachName: string) => {
    if (!confirm(`Remove ${coachName} from this squad?`)) return;

    try {
      await removeCoachFromSquad(membershipId);
      await loadCoaches();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdatePermissions = async (membership: CoachSquadMembership, updates: Partial<SquadPermissions>) => {
    if (!user?.id) return;

    try {
      await updateCoachPermissions(membership.id, updates, user.id);
      await loadCoaches();
      setEditingPermissions(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      owner: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      admin: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
      member: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
    };
    return styles[role as keyof typeof styles] || styles.member;
  };

  // Filter out connections who are already in the squad
  const availableConnections = connections.filter(
    conn => !coaches.some(coach => {
      const connCoachId = conn.requester_id === user?.id ? conn.recipient_id : conn.requester_id;
      return coach.coach_id === connCoachId;
    })
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-text-primary">Squad Coaches</h3>
          <p className="text-sm text-text-muted mt-1">{coaches.length} coach{coaches.length !== 1 ? 'es' : ''} with access</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium"
          >
            <UserPlus size={16} />
            Add Coach
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Add Coach Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-elevated rounded-xl border border-border max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Add Coach to Squad</h3>
            
            {availableConnections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-text-muted mb-4">
                  You don't have any connections to add. Connect with other coaches in the Network page first.
                </p>
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-background-secondary transition-all font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddCoach} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Select Coach
                  </label>
                  <select
                    value={selectedCoachId}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Choose a coach...</option>
                    {availableConnections.map((conn) => {
                      const coachId = conn.requester_id === user?.id ? conn.recipient_id : conn.requester_id;
                      return (
                        <option key={conn.id} value={coachId}>
                          {conn.coach ? `${conn.coach.first_name} ${conn.coach.last_name}` : `Coach ${coachId.substring(0, 8)}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'member')}
                    className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-text-muted mt-1">
                    {selectedRole === 'admin' ? 'Can manage most squad features' : 'Limited permissions'}
                  </p>
                </div>

                {error && (
                  <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all font-medium"
                  >
                    Add to Squad
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2 bg-background-tertiary text-text-secondary rounded-lg hover:bg-background-secondary transition-all font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Coaches List */}
      <div className="space-y-3">
        {coaches.map((membership) => (
          <div
            key={membership.id}
            className="bg-background-elevated rounded-xl border border-border p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {membership.coach?.first_name?.[0]}{membership.coach?.last_name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-text-primary">
                      {membership.coach ? `${membership.coach.first_name} ${membership.coach.last_name}` : `Coach ${membership.coach_id.substring(0, 8)}`}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRoleBadge(membership.role)}`}>
                      {membership.role}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">ID: {membership.coach_id.substring(0, 8)}</p>
                </div>
              </div>

              {canManage && membership.role !== 'owner' && membership.coach_id !== user?.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingPermissions(editingPermissions === membership.id ? null : membership.id)}
                    className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-all"
                    title="Edit permissions"
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    onClick={() => handleRemoveCoach(
                      membership.id, 
                      membership.coach ? `${membership.coach.first_name} ${membership.coach.last_name}` : `Coach ${membership.coach_id.substring(0, 8)}`
                    )}
                    className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded transition-all"
                    title="Remove coach"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Permissions Editor */}
            {editingPermissions === membership.id && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <p className="text-xs font-medium text-text-secondary mb-2">Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'can_manage_swimmers', label: 'Manage Swimmers' },
                    { key: 'can_manage_workouts', label: 'Manage Workouts' },
                    { key: 'can_manage_results', label: 'Manage Results' },
                    { key: 'can_manage_attendance', label: 'Manage Attendance' },
                    { key: 'can_manage_schedules', label: 'Manage Schedules' },
                    { key: 'can_manage_sessions', label: 'Manage Sessions' },
                    { key: 'can_view_analytics', label: 'View Analytics' },
                    { key: 'can_manage_notes', label: 'Manage Notes' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={membership.permissions[perm.key as keyof SquadPermissions] as boolean}
                        onChange={(e) => handleUpdatePermissions(membership, { [perm.key]: e.target.checked })}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
