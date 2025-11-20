// hooks/api/__tests__/useCoachApi.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCoachApi } from '../useCoachApi';
import { useUIStore } from '@/stores/uiStore';
import * as coachService from '@/services/coachService';

// Mock the service
vi.mock('../../../services/coachService', () => ({
  getCoachConnections: vi.fn(),
  sendConnectionRequest: vi.fn(),
  respondToConnectionRequest: vi.fn(),
  removeConnection: vi.fn(),
  addCoachToSquad: vi.fn(),
}));

describe('useCoachApi', () => {
  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      toasts: [],
      modals: new Map(),
      globalLoading: false,
      loadingStates: new Map(),
      searchQuery: '',
      filters: new Map(),
      sidebarOpen: true,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('fetchConnections', () => {
    it('should fetch connections successfully', async () => {
      const mockResult = {
        connections: [
          {
            id: 'conn-1',
            requester_id: 'user-1',
            recipient_id: 'coach-2',
            status: 'accepted' as const,
            created_at: '2025-01-01',
          },
        ],
        pendingRequests: [],
      };
      vi.mocked(coachService.getCoachConnections).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useCoachApi());

      let connections: any;
      await act(async () => {
        connections = await result.current.fetchConnections('user-1');
      });

      expect(coachService.getCoachConnections).toHaveBeenCalledWith('user-1');
      expect(connections).toEqual(mockResult);
    });

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch connections');
      vi.mocked(coachService.getCoachConnections).mockRejectedValue(error);

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        try {
          await result.current.fetchConnections('user-1');
        } catch (e) {
          // Expected to throw
        }
      });

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('error');
      expect(uiStore.toasts[0].message).toBe('Failed to fetch connections');
    });
  });

  describe('sendConnectionRequest', () => {
    it('should send connection request and show success toast', async () => {
      vi.mocked(coachService.sendConnectionRequest).mockResolvedValue();

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        await result.current.sendConnectionRequest('user-1', 'test@example.com');
      });

      expect(coachService.sendConnectionRequest).toHaveBeenCalledWith('user-1', 'test@example.com');

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('success');
      expect(uiStore.toasts[0].message).toBe('Connection request sent successfully!');
    });

    it('should show error toast on failure', async () => {
      const error = new Error('Coach not found');
      vi.mocked(coachService.sendConnectionRequest).mockRejectedValue(error);

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        try {
          await result.current.sendConnectionRequest('user-1', 'test@example.com');
        } catch (e) {
          // Expected to throw
        }
      });

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('error');
      expect(uiStore.toasts[0].message).toBe('Coach not found');
    });
  });

  describe('acceptConnectionRequest', () => {
    it('should accept connection request and show success toast', async () => {
      vi.mocked(coachService.respondToConnectionRequest).mockResolvedValue();

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        await result.current.acceptConnectionRequest('conn-1');
      });

      expect(coachService.respondToConnectionRequest).toHaveBeenCalledWith('conn-1', true);

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('success');
      expect(uiStore.toasts[0].message).toBe('Connection request accepted');
    });

    it('should show error toast on failure', async () => {
      const error = new Error('Update failed');
      vi.mocked(coachService.respondToConnectionRequest).mockRejectedValue(error);

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        try {
          await result.current.acceptConnectionRequest('conn-1');
        } catch (e) {
          // Expected to throw
        }
      });

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('error');
      expect(uiStore.toasts[0].message).toBe('Update failed');
    });
  });

  describe('declineConnectionRequest', () => {
    it('should decline connection request and show success toast', async () => {
      vi.mocked(coachService.respondToConnectionRequest).mockResolvedValue();

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        await result.current.declineConnectionRequest('conn-1');
      });

      expect(coachService.respondToConnectionRequest).toHaveBeenCalledWith('conn-1', false);

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('success');
      expect(uiStore.toasts[0].message).toBe('Connection request declined');
    });
  });

  describe('removeConnection', () => {
    it('should remove connection and show success toast', async () => {
      vi.mocked(coachService.removeConnection).mockResolvedValue();

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        await result.current.removeConnection('conn-1');
      });

      expect(coachService.removeConnection).toHaveBeenCalledWith('conn-1');

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('success');
      expect(uiStore.toasts[0].message).toBe('Connection removed successfully');
    });

    it('should show error toast on failure', async () => {
      const error = new Error('Delete failed');
      vi.mocked(coachService.removeConnection).mockRejectedValue(error);

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        try {
          await result.current.removeConnection('conn-1');
        } catch (e) {
          // Expected to throw
        }
      });

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('error');
      expect(uiStore.toasts[0].message).toBe('Delete failed');
    });
  });

  describe('addCoachToSquad', () => {
    it('should add coach to squad and show success toast', async () => {
      vi.mocked(coachService.addCoachToSquad).mockResolvedValue();

      const { result } = renderHook(() => useCoachApi());
      const permissions = { can_manage_swimmers: true };

      await act(async () => {
        await result.current.addCoachToSquad('squad-1', 'coach-1', 'admin', 'creator-1', permissions);
      });

      expect(coachService.addCoachToSquad).toHaveBeenCalledWith(
        'squad-1',
        'coach-1',
        'admin',
        'creator-1',
        permissions
      );

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('success');
      expect(uiStore.toasts[0].message).toBe('Coach added to squad successfully');
    });

    it('should show error toast on failure', async () => {
      const error = new Error('Already a member');
      vi.mocked(coachService.addCoachToSquad).mockRejectedValue(error);

      const { result } = renderHook(() => useCoachApi());

      await act(async () => {
        try {
          await result.current.addCoachToSquad('squad-1', 'coach-1', 'member', 'creator-1', {});
        } catch (e) {
          // Expected to throw
        }
      });

      const uiStore = useUIStore.getState();
      expect(uiStore.toasts.length).toBe(1);
      expect(uiStore.toasts[0].type).toBe('error');
      expect(uiStore.toasts[0].message).toBe('Already a member');
    });
  });
});
