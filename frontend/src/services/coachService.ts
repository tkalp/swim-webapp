// services/coachService.ts
import { supabase } from '@/lib/supabase';

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
  requester?: Coach;
  recipient?: Coach;
}

export interface CoachConnectionsResult {
  connections: CoachConnection[];
  pendingRequests: CoachConnection[];
}

/**
 * Get all coach connections for the authenticated user
 * @param userId - The ID of the authenticated user
 * @returns Object containing accepted connections and pending requests
 */
export async function getCoachConnections(userId: string): Promise<CoachConnectionsResult> {
  // Get accepted connections
  const { data: acceptedData, error: acceptedError } = await supabase
    .from('coach_connections')
    .select('*')
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (acceptedError) throw acceptedError;

  // Get pending requests (where user is the recipient)
  const { data: pendingData, error: pendingError } = await supabase
    .from('coach_connections')
    .select('*')
    .eq('recipient_id', userId)
    .eq('status', 'pending');

  if (pendingError) throw pendingError;

  // Fetch coach names
  const allCoachIds = new Set<string>();
  acceptedData?.forEach(conn => {
    allCoachIds.add(conn.requester_id);
    allCoachIds.add(conn.recipient_id);
  });
  pendingData?.forEach(conn => {
    allCoachIds.add(conn.requester_id);
  });

  const { data: coaches } = await supabase
    .from('coach')
    .select('id, first_name, last_name')
    .in('id', Array.from(allCoachIds));

  const coachMap = new Map(coaches?.map(c => [c.id, c]) || []);

  // Attach coach info to connections
  const connections = acceptedData?.map(conn => ({
    ...conn,
    requester: coachMap.get(conn.requester_id),
    recipient: coachMap.get(conn.recipient_id),
  })) || [];

  const pendingRequests = pendingData?.map(conn => ({
    ...conn,
    requester: coachMap.get(conn.requester_id),
    recipient: coachMap.get(conn.recipient_id),
  })) || [];

  return { connections, pendingRequests };
}

/**
 * Send a connection request to a coach by email
 * @param requesterId - The ID of the user sending the request
 * @param email - The email address of the coach to connect with
 * @throws Error if email not found, already connected, or validation fails
 */
export async function sendConnectionRequest(requesterId: string, email: string): Promise<void> {
  const trimmedEmail = email.toLowerCase().trim();

  // Find the coach by email
  const { data: coaches, error: searchError } = await supabase
    .from('coach')
    .select('id, email')
    .eq('email', trimmedEmail)
    .limit(1);

  if (searchError) throw searchError;

  if (!coaches || coaches.length === 0) {
    throw new Error('No coach found with that email address');
  }

  const recipientId = coaches[0].id;

  if (recipientId === requesterId) {
    throw new Error("You can't send a connection request to yourself");
  }

  // Check if connection already exists
  const { data: existing } = await supabase
    .from('coach_connections')
    .select('id, status')
    .or(`and(requester_id.eq.${requesterId},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${requesterId})`)
    .limit(1);

  if (existing && existing.length > 0) {
    if (existing[0].status === 'pending') {
      throw new Error('A connection request is already pending');
    } else if (existing[0].status === 'accepted') {
      throw new Error('You are already connected with this coach');
    } else {
      throw new Error('Cannot send connection request');
    }
  }

  // Create the connection request
  const { error: insertError } = await supabase
    .from('coach_connections')
    .insert({
      requester_id: requesterId,
      recipient_id: recipientId,
      status: 'pending',
    });

  if (insertError) throw insertError;
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
  const { error } = await supabase
    .from('coach_connections')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', connectionId);

  if (error) throw error;
}

/**
 * Remove a connection between coaches
 * @param connectionId - The ID of the connection to remove
 */
export async function removeConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('coach_connections')
    .delete()
    .eq('id', connectionId);

  if (error) throw error;
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
  createdBy: string,
  permissions: Record<string, boolean>
): Promise<void> {
  const { error } = await supabase
    .from('coach_squads')
    .insert({
      squad_id: squadId,
      coach_id: coachId,
      role,
      created_by: createdBy,
      ...permissions,
    });

  if (error) throw error;
}
