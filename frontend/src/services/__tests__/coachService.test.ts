// services/__tests__/coachService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCoachConnections,
  sendConnectionRequest,
  respondToConnectionRequest,
  removeConnection,
  addCoachToSquad,
} from '../coachService';
import { apiClient } from '@/lib/apiClient';

describe('coachService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCoachConnections', () => {
    it('should fetch accepted connections', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          requester_id: 'user-1',
          recipient_id: 'coach-2',
          status: 'accepted',
          created_at: '2025-01-01',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValue({ connections: mockConnections });

      const result = await getCoachConnections('user-1');

      expect(result.connections).toHaveLength(1);
      expect(result.connections).toEqual(mockConnections);
      expect(result.pendingRequests).toEqual([]);
      expect(apiClient.get).toHaveBeenCalledWith('/coach-connections/my-connections');
    });

    it('should handle empty results', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ connections: [] });

      const result = await getCoachConnections('user-1');

      expect(result.connections).toEqual([]);
      expect(result.pendingRequests).toEqual([]);
    });

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch connections'));

      await expect(getCoachConnections('user-1')).rejects.toThrow('Failed to fetch connections');
    });
  });

  describe('sendConnectionRequest', () => {
    it('should send connection request successfully', async () => {
      // First call: search for coach by email
      vi.mocked(apiClient.get).mockResolvedValue({
        coaches: [{ id: 'coach-2', email: 'test@example.com' }],
      });

      // Second call: send request
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await sendConnectionRequest('user-1', 'test@example.com');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/coach-connections/search?email=test%40example.com'
      );
      expect(apiClient.post).toHaveBeenCalledWith('/coach-connections/request', {
        recipient_id: 'coach-2',
      });
    });

    it('should throw error if coach not found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ coaches: [] });

      await expect(sendConnectionRequest('user-1', 'notfound@example.com'))
        .rejects.toThrow('No coach found with that email address');
    });
  });

  describe('respondToConnectionRequest', () => {
    it('should accept connection request', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await respondToConnectionRequest('conn-1', true);

      expect(apiClient.post).toHaveBeenCalledWith('/coach-connections/respond', {
        connection_id: 'conn-1',
        accept: true,
      });
    });

    it('should decline connection request', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await respondToConnectionRequest('conn-1', false);

      expect(apiClient.post).toHaveBeenCalledWith('/coach-connections/respond', {
        connection_id: 'conn-1',
        accept: false,
      });
    });

    it('should throw error on failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to respond'));

      await expect(respondToConnectionRequest('conn-1', true))
        .rejects.toThrow('Failed to respond');
    });
  });

  describe('removeConnection', () => {
    it('should remove connection successfully', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await removeConnection('conn-1');

      expect(apiClient.delete).toHaveBeenCalledWith('/coach-connections/conn-1');
    });

    it('should throw error on failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Failed to remove connection'));

      await expect(removeConnection('conn-1')).rejects.toThrow('Failed to remove connection');
    });
  });

  describe('addCoachToSquad', () => {
    it('should add coach to squad with permissions', async () => {
      const permissions = {
        can_manage_swimmers: true,
        can_manage_workouts: false,
      };

      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await addCoachToSquad('squad-1', 'coach-1', 'admin', 'creator-1', permissions);

      expect(apiClient.post).toHaveBeenCalledWith('/api/permissions/squad-coach', {
        squad_id: 'squad-1',
        coach_id: 'coach-1',
        role: 'admin',
        ...permissions,
      });
    });

    it('should throw error on failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to add coach'));

      await expect(addCoachToSquad('squad-1', 'coach-1', 'member', 'creator-1', {}))
        .rejects.toThrow('Failed to add coach');
    });
  });
});
