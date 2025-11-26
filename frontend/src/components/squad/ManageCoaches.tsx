// components/squad/ManageCoaches.tsx
import { useState, useEffect } from 'react';
import { UserPlus, Shield, Trash2, Mail, Check, X, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoachApi } from '@/hooks/api/useCoachApi';
import { SquadTabHeader } from '@/components/squad/SquadTabHeader';
import {
  getSquadCoaches,
  updateCoachPermissions,
  removeCoachFromSquad,
  DEFAULT_PERMISSIONS,
  type CoachSquadMembership,
  type SquadPermissions,
} from '@/services/permissionService';
import type { CoachConnection } from '@/services/coachService';

interface ManageCoachesProps {
  squadId: string;
  canManage: boolean;
}

export function ManageCoaches({ squadId, canManage }: ManageCoachesProps) {
  const { user } = useAuth();
  const coachApi = useCoachApi();
  const [coaches, setCoaches] = useState<CoachSquadMembership[]>([]);
  const [connections, setConnections] = useState<CoachConnection[]>([]);
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
      const result = await coachApi.fetchConnections(user.id);
      setConnections(result.connections);
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
      await coachApi.addCoachToSquad(
        squadId,
        selectedCoachId,
        selectedRole,
        user.id,
        DEFAULT_PERMISSIONS[selectedRole] as Record<string, boolean>
      );

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
      <SquadTabHeader
        title="Squad Coaches"
        subtitle={`${coaches.length} coach${coaches.length !== 1 ? 'es' : ''} with access`}
        actions={
          canManage ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium"
            >
              <UserPlus size={16} />
              Add Coach
            </button>
          ) : undefined
        }
      />

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Add Coach Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/90 rounded-xl border border-slate-700 max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Add Coach to Squad</h3>
            
            {availableConnections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-4">
                  You don't have any connections to add. Connect with other coaches in the Network page first.
                </p>
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 bg-slate-800/50 text-slate-400 rounded-lg hover:bg-slate-800/70 transition-all font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddCoach} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-2">
                    Select Coach
                  </label>
                  <select
                    value={selectedCoachId}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Choose a coach...</option>
                    {availableConnections.map((conn) => {
                      const coachId = conn.requester_id === user?.id ? conn.recipient_id : conn.requester_id;
                      const coach = conn.requester_id === user?.id ? conn.recipient : conn.requester;
                      return (
                        <option key={conn.id} value={coachId}>
                          {coach ? `${coach.first_name} ${coach.last_name}` : `Coach ${coachId.substring(0, 8)}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-2">
                    Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'member')}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedRole === 'admin' ? 'Can manage most squad features' : 'Limited permissions'}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-500">
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
                    className="px-4 py-2 bg-slate-800/50 text-slate-400 rounded-lg hover:bg-slate-800/70 transition-all font-medium"
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
            className="group relative overflow-hidden bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200"
          >
            {/* Subtle glow on hover */}
            <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shadow-lg">
                  {membership.coach?.first_name?.[0]}{membership.coach?.last_name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-100">
                      {membership.coach ? `${membership.coach.first_name} ${membership.coach.last_name}` : `Coach ${membership.coach_id.substring(0, 8)}`}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getRoleBadge(membership.role)}`}>
                      {membership.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">ID: {membership.coach_id.substring(0, 8)}</p>
                </div>
              </div>

              {canManage && membership.role !== 'owner' && membership.coach_id !== user?.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingPermissions(editingPermissions === membership.id ? null : membership.id)}
                    className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded transition-all"
                    title="Edit permissions"
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    onClick={() => handleRemoveCoach(
                      membership.id, 
                      membership.coach ? `${membership.coach.first_name} ${membership.coach.last_name}` : `Coach ${membership.coach_id.substring(0, 8)}`
                    )}
                    className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                    title="Remove coach"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Permissions Editor */}
            {editingPermissions === membership.id && (
              <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                <p className="text-xs font-medium text-slate-400 mb-2">Permissions</p>
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
                    <label key={perm.key} className="flex items-center gap-2 text-xs text-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={membership.permissions[perm.key as keyof SquadPermissions] as boolean}
                        onChange={(e) => handleUpdatePermissions(membership, { [perm.key]: e.target.checked })}
                        className="rounded border-slate-700 text-primary focus:ring-primary"
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


