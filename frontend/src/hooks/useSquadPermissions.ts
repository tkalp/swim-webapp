// hooks/useSquadPermissions.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { set } from "date-fns";

export interface SquadPermissions {
  role: "owner" | "admin" | "member";
  can_manage_swimmers: boolean;
  can_manage_workouts: boolean;
  can_manage_results: boolean;
  can_manage_attendance: boolean;
  can_manage_schedules: boolean;
  can_view_analytics: boolean;
  can_manage_squad_settings: boolean;
  can_manage_coaches: boolean;
  can_manage_sessions: boolean;
  can_manage_notes: boolean;
  can_view_notes: boolean;
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

const DEFAULT_PERMISSIONS: Record<
  "owner" | "admin" | "member",
  Partial<SquadPermissions>
> = {
  owner: {
    can_manage_swimmers: true,
    can_manage_workouts: true,
    can_manage_results: true,
    can_manage_attendance: true,
    can_manage_schedules: true,
    can_view_analytics: true,
    can_manage_squad_settings: true,
    can_manage_coaches: true,
    can_manage_sessions: true,
    can_manage_notes: true,
    can_view_notes: true,
  },
  admin: {
    can_manage_swimmers: true,
    can_manage_workouts: true,
    can_manage_results: true,
    can_manage_attendance: true,
    can_manage_schedules: true,
    can_view_analytics: true,
    can_manage_squad_settings: false,
    can_manage_coaches: true,
    can_manage_sessions: true,
    can_manage_notes: true,
    can_view_notes: true,
  },
  member: {
    can_manage_swimmers: false,
    can_manage_workouts: false,
    can_manage_results: false,
    can_manage_attendance: false,
    can_manage_schedules: false,
    can_view_analytics: false,
    can_manage_squad_settings: false,
    can_manage_coaches: false,
    can_manage_sessions: false,
    can_manage_notes: true,
    can_view_notes: true,
  },
};

export function useSquadPermissions(squadId: string | undefined) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<SquadPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!squadId || !user?.id) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [squadId, user?.id]);

  const hasPermission = (
    permission: keyof Omit<SquadPermissions, "role">
  ): boolean => {
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  const isOwner = permissions?.role === "owner";
  const isAdmin =
    permissions?.role === "admin" || permissions?.role === "owner";

  const loadPermissions = async () => {
    if (!squadId || !user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("coach_squads")
        .select("*")
        .eq("squad_id", squadId)
        .eq("coach_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        // Owner and admin roles get default permissions
        if (data.role === "owner" || data.role === "admin") {
          console.log("Setting default perms for role: " + data.role);
          const defaultPerms =
            DEFAULT_PERMISSIONS[data.role as "owner" | "admin"];
          setPermissions({
            role: data.role,
            ...defaultPerms,
          } as SquadPermissions);
          return;
        }

        // Member role uses database permissions
        setPermissions({
          role: data.role,
          can_manage_swimmers: data.can_manage_swimmers,
          can_manage_workouts: data.can_manage_workouts,
          can_manage_results: data.can_manage_results,
          can_manage_attendance: data.can_manage_attendance,
          can_manage_schedules: data.can_manage_schedules,
          can_view_analytics: data.can_view_analytics,
          can_manage_squad_settings: data.can_manage_squad_settings,
          can_manage_coaches: data.can_manage_coaches,
          can_manage_sessions: data.can_manage_sessions,
          can_manage_notes: data.can_manage_notes,
          can_view_notes: data.can_view_notes,
        });
      }
    } catch (err: any) {
      setError(err.message);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    permissions,
    loading,
    error,
    hasPermission,
    isOwner,
    isAdmin,
    reload: loadPermissions,
  };
}

export async function getSquadCoaches(
  squadId: string
): Promise<CoachSquadMembership[]> {
  const { data: memberships, error } = await supabase
    .from("coach_squads")
    .select("*")
    .eq("squad_id", squadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!memberships || memberships.length === 0) return [];

  // Fetch coach names from coaches table
  const coachIds = memberships.map((m) => m.coach_id);
  const { data: coaches } = await supabase
    .from("coach")
    .select("id, first_name, last_name")
    .in("id", coachIds);

  const coachMap = new Map(coaches?.map((c) => [c.id, c]) || []);

  return memberships.map((item) => ({
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
      can_view_analytics: item.can_view_analytics,
      can_manage_squad_settings: item.can_manage_squad_settings,
      can_manage_coaches: item.can_manage_coaches,
      can_manage_sessions: item.can_manage_sessions,
      can_manage_notes: item.can_manage_notes,
      can_view_notes: item.can_view_notes,
    },
    coach: coachMap.get(item.coach_id),
  }));
}

export async function updateCoachPermissions(
  membershipId: string,
  permissions: Partial<SquadPermissions>,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("coach_squads")
    .update({
      ...permissions,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq("id", membershipId);

  if (error) throw error;
}

export async function removeCoachFromSquad(
  membershipId: string
): Promise<void> {
  const { error } = await supabase
    .from("coach_squads")
    .delete()
    .eq("id", membershipId);

  if (error) throw error;
}

export async function inviteCoachToSquad(
  squadId: string,
  inviterId: string,
  invitedEmail: string,
  role: "owner" | "admin" | "member" = "member",
  message?: string
): Promise<void> {
  const { error } = await supabase.from("squad_invitations").insert({
    squad_id: squadId,
    inviter_id: inviterId,
    invited_email: invitedEmail,
    role,
    message,
    status: "pending",
  });

  if (error) throw error;
}

export { DEFAULT_PERMISSIONS };
