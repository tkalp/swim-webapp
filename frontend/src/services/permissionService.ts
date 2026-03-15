// services/permissionService.ts
import { apiClient } from '@/lib/apiClient'

export interface SquadPermissions {
  role: "owner" | "admin" | "member";
  can_manage_swimmers: boolean;
  can_manage_workouts: boolean;
  can_manage_results: boolean;
  can_manage_attendance: boolean;
  can_manage_schedules: boolean;
  can_manage_notes: boolean;
  can_view_analytics: boolean;
  can_manage_squad_settings: boolean;
}

export interface CoachSquadMembership {
  id: string;
  coach_id: string;
  squad_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  permissions: SquadPermissions;
  coach?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

/**
 * Get coach permissions for a specific squad.
 * All 8 boolean permission fields come directly from the DB.
 */
export async function getCoachPermissions(
  squadId: string,
  coachId: string
): Promise<SquadPermissions | null> {
  const memberships = await apiClient.get<any[]>(`/permissions/squad/${squadId}/coaches`);

  const data = memberships.find((m: any) => m.coach_id === coachId);

  if (!data) return null;

  return {
    role: data.role,
    can_manage_swimmers: data.can_manage_swimmers,
    can_manage_workouts: data.can_manage_workouts,
    can_manage_results: data.can_manage_results,
    can_manage_attendance: data.can_manage_attendance,
    can_manage_schedules: data.can_manage_schedules,
    can_manage_notes: data.can_manage_notes,
    can_view_analytics: data.can_view_analytics,
    can_manage_squad_settings: data.can_manage_squad_settings,
  };
}

/**
 * Get all coaches for a squad with their permissions
 */
export async function getSquadCoaches(
  squadId: string
): Promise<CoachSquadMembership[]> {
  const memberships = await apiClient.get<any[]>(`/permissions/squad/${squadId}/coaches`);

  if (!memberships || memberships.length === 0) return [];

  return memberships.map((item: any) => ({
    id: item.id,
    coach_id: item.coach_id,
    squad_id: item.squad_id,
    role: item.role,
    created_at: item.created_at,
    created_by: item.created_by,
    updated_at: item.updated_at,
    updated_by: item.updated_by,
    permissions: {
      role: item.role,
      can_manage_swimmers: item.can_manage_swimmers,
      can_manage_workouts: item.can_manage_workouts,
      can_manage_results: item.can_manage_results,
      can_manage_attendance: item.can_manage_attendance,
      can_manage_schedules: item.can_manage_schedules,
      can_manage_notes: item.can_manage_notes,
      can_view_analytics: item.can_view_analytics,
      can_manage_squad_settings: item.can_manage_squad_settings,
    },
    coach: item.coach,
  }));
}

/**
 * Update coach permissions for a squad membership
 */
export async function updateCoachPermissions(
  membershipId: string,
  permissions: Partial<SquadPermissions>,
  updatedBy: string
): Promise<void> {
  await apiClient.put(`/permissions/squad-coach/${membershipId}`, {
    ...permissions,
    updated_by: updatedBy,
  });
}

/**
 * Remove a coach from a squad
 */
export async function removeCoachFromSquad(
  membershipId: string
): Promise<void> {
  await apiClient.delete(`/permissions/squad-coach/${membershipId}`);
}

/**
 * Invite a coach to a squad
 */
export async function inviteCoachToSquad(
  squadId: string,
  _inviterId: string,
  invitedEmail: string,
  role: "owner" | "admin" | "member" = "member",
  _message?: string
): Promise<void> {
  await apiClient.post('/permissions/invitations', {
    squad_id: squadId,
    email: invitedEmail,
    role,
  });
}
