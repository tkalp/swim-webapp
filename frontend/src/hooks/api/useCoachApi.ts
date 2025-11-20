// hooks/api/useCoachApi.ts
import { useCallback } from 'react';
import {
  getCoachConnections,
  sendConnectionRequest as sendConnectionRequestService,
  respondToConnectionRequest as respondToConnectionRequestService,
  removeConnection as removeConnectionService,
  addCoachToSquad as addCoachToSquadService,
  type CoachConnectionsResult,
} from '../../services/coachService';
import { useUIStore } from '../../stores/uiStore';

/**
 * Coach API hooks with automatic error handling and user feedback
 * Uses Supabase services with toast notifications
 */
export const useCoachApi = () => {
  const { addToast } = useUIStore();

  /**
   * Fetch all coach connections and pending requests
   */
  const fetchConnections = useCallback(async (userId: string): Promise<CoachConnectionsResult> => {
    try {
      const result = await getCoachConnections(userId);
      return result;
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch connections', type: 'error' });
      throw error;
    }
  }, [addToast]);

  /**
   * Send a connection request to a coach by email
   */
  const sendConnectionRequest = useCallback(async (requesterId: string, email: string): Promise<void> => {
    try {
      await sendConnectionRequestService(requesterId, email);
      addToast({ message: 'Connection request sent successfully!', type: 'success' });
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to send connection request', type: 'error' });
      throw error;
    }
  }, [addToast]);

  /**
   * Accept a connection request
   */
  const acceptConnectionRequest = useCallback(async (connectionId: string): Promise<void> => {
    try {
      await respondToConnectionRequestService(connectionId, true);
      addToast({ message: 'Connection request accepted', type: 'success' });
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to accept connection', type: 'error' });
      throw error;
    }
  }, [addToast]);

  /**
   * Decline a connection request
   */
  const declineConnectionRequest = useCallback(async (connectionId: string): Promise<void> => {
    try {
      await respondToConnectionRequestService(connectionId, false);
      addToast({ message: 'Connection request declined', type: 'success' });
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to decline connection', type: 'error' });
      throw error;
    }
  }, [addToast]);

  /**
   * Remove a connection between coaches
   */
  const removeConnection = useCallback(async (connectionId: string): Promise<void> => {
    try {
      await removeConnectionService(connectionId);
      addToast({ message: 'Connection removed successfully', type: 'success' });
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to remove connection', type: 'error' });
      throw error;
    }
  }, [addToast]);

  /**
   * Add a coach to a squad with specific role and permissions
   */
  const addCoachToSquad = useCallback(async (
    squadId: string,
    coachId: string,
    role: 'admin' | 'member',
    createdBy: string,
    permissions: Record<string, boolean>
  ): Promise<void> => {
    try {
      await addCoachToSquadService(squadId, coachId, role, createdBy, permissions);
      addToast({ message: 'Coach added to squad successfully', type: 'success' });
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to add coach to squad', type: 'error' });
      throw error;
    }
  }, [addToast]);

  return {
    fetchConnections,
    sendConnectionRequest,
    acceptConnectionRequest,
    declineConnectionRequest,
    removeConnection,
    addCoachToSquad,
  };
};
