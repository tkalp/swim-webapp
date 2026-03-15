// services/coachService.ts
import { apiClient } from '@/lib/apiClient'

export interface Coach {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

export interface CoachConnection {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  created_at: string;
  updated_at?: string;
  requester?: Coach;
  recipient?: Coach;
}

export interface CoachConnectionsResult {
  connections: CoachConnection[];
  pendingRequests: CoachConnection[];
}

/**
 * Get all coach connections for the authenticated user
 * @param _userId - The ID of the authenticated user (no longer needed, backend uses JWT)
 * @returns Object containing accepted connections and pending requests
 */
export async function getCoachConnections(_userId: string): Promise<CoachConnectionsResult> {
  const [connectionsData, pendingData] = await Promise.all([
    apiClient.get<{ connections: CoachConnection[] }>('/coach-connections/my-connections'),
    apiClient.get<CoachConnection[]>('/coach-connections/pending').catch(() => [] as CoachConnection[]),
  ]);

  return {
    connections: connectionsData.connections || [],
    pendingRequests: Array.isArray(pendingData) ? pendingData : [],
  };
}

/**
 * Send a connection request to a coach by email
 * @param _requesterId - The ID of the user sending the request (backend uses JWT)
 * @param email - The email address of the coach to connect with
 * @throws Error if email not found, already connected, or validation fails
 */
export async function sendConnectionRequest(_requesterId: string, email: string): Promise<void> {
  const trimmedEmail = email.toLowerCase().trim();

  // Search for the coach by email using the backend search endpoint
  const searchResult = await apiClient.get<{ coaches: Array<{ id: string; user_id?: string }> }>(
    `/coach-connections/search?email=${encodeURIComponent(trimmedEmail)}`
  );

  if (!searchResult.coaches || searchResult.coaches.length === 0) {
    throw new Error('No coach found with that email address');
  }

  const recipientId = searchResult.coaches[0].id;

  // Send the connection request
  await apiClient.post('/coach-connections/request', {
    recipient_id: recipientId,
  });
}

/**
 * Accept or decline a connection request
 * @param connectionId - The ID of the connection to respond to
 * @param accept - True to accept, false to decline
 */
export async function respondToConnectionRequest(
  connectionId: string,
  accept: boolean
): Promise<void> {
  await apiClient.post('/coach-connections/respond', {
    connection_id: connectionId,
    accept,
  });
}

/**
 * Remove a connection between coaches
 * @param connectionId - The ID of the connection to remove
 */
export async function removeConnection(connectionId: string): Promise<void> {
  await apiClient.delete(`/coach-connections/${connectionId}`);
}

/**
 * Add a coach to a squad with a specific role
 * @param squadId - The ID of the squad
 * @param coachId - The ID of the coach to add
 * @param role - The role to assign (admin or member)
 * @param createdBy - The ID of the user adding the coach
 * @param permissions - The permissions to grant
 */
export async function addCoachToSquad(
  squadId: string,
  coachId: string,
  role: 'admin' | 'member',
  _createdBy: string,
  permissions: Record<string, boolean>
): Promise<void> {
  await apiClient.post('/permissions/squad-coach', {
    squad_id: squadId,
    coach_id: coachId,
    role,
    ...permissions,
  });
}
