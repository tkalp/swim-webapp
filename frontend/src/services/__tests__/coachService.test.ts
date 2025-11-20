// services/__tests__/coachService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCoachConnections,
  sendConnectionRequest,
  respondToConnectionRequest,
  removeConnection,
  addCoachToSquad,
} from '../coachService';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('coachService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCoachConnections', () => {
    it('should fetch accepted connections and pending requests', async () => {
      const userId = 'user-1';
      const mockAccepted = [
        {
          id: 'conn-1',
          requester_id: userId,
          recipient_id: 'coach-2',
          status: 'accepted',
          created_at: '2025-01-01',
        },
      ];
      const mockPending = [
        {
          id: 'conn-2',
          requester_id: 'coach-3',
          recipient_id: userId,
          status: 'pending',
          created_at: '2025-01-02',
        },
      ];
      const mockCoaches = [
        { id: 'coach-2', first_name: 'John', last_name: 'Doe' },
        { id: 'coach-3', first_name: 'Jane', last_name: 'Smith' },
        { id: userId, first_name: 'Me', last_name: 'Myself' },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coach_connections') {
          callCount++;
          const isFirstCall = callCount === 1;
          
          if (isFirstCall) {
            // First call: .or().eq('status', 'accepted')
            return {
              select: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: mockAccepted, error: null }),
                }),
              }),
            } as any;
          } else {
            // Second call: .eq('recipient_id', userId).eq('status', 'pending')
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: mockPending, error: null }),
                }),
              }),
            } as any;
          }
        } else if (table === 'coach') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockCoaches, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await getCoachConnections(userId);

      expect(result.connections).toHaveLength(1);
      expect(result.pendingRequests).toHaveLength(1);
      expect(result.connections[0].recipient).toEqual(mockCoaches[0]);
      expect(result.pendingRequests[0].requester).toEqual(mockCoaches[1]);
    });

    it('should handle empty results', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coach_connections') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any;
        } else if (table === 'coach') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as any;
        }
        return {} as any;
      });

      const result = await getCoachConnections('user-1');

      expect(result.connections).toEqual([]);
      expect(result.pendingRequests).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      } as any);

      await expect(getCoachConnections('user-1')).rejects.toEqual({ message: 'DB error' });
    });
  });

  describe('sendConnectionRequest', () => {
    it('should send connection request successfully', async () => {
      const mockCoaches = [{ id: 'coach-2', email: 'test@example.com' }];
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coach') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockCoaches, error: null }),
          } as any;
        } else if (table === 'coach_connections') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: insertMock,
          } as any;
        }
        return {} as any;
      });

      await sendConnectionRequest('user-1', 'test@example.com');

      expect(insertMock).toHaveBeenCalledWith({
        requester_id: 'user-1',
        recipient_id: 'coach-2',
        status: 'pending',
      });
    });

    it('should throw error if coach not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      await expect(sendConnectionRequest('user-1', 'notfound@example.com'))
        .rejects.toThrow('No coach found with that email address');
    });

    it('should throw error if requesting connection to self', async () => {
      const mockCoaches = [{ id: 'user-1', email: 'self@example.com' }];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockCoaches, error: null }),
      } as any);

      await expect(sendConnectionRequest('user-1', 'self@example.com'))
        .rejects.toThrow("You can't send a connection request to yourself");
    });

    it('should throw error if connection already pending', async () => {
      const mockCoaches = [{ id: 'coach-2', email: 'test@example.com' }];
      const mockExisting = [{ id: 'conn-1', status: 'pending' }];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coach') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockCoaches, error: null }),
          } as any;
        } else if (table === 'coach_connections') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockExisting, error: null }),
          } as any;
        }
        return {} as any;
      });

      await expect(sendConnectionRequest('user-1', 'test@example.com'))
        .rejects.toThrow('A connection request is already pending');
    });

    it('should throw error if already connected', async () => {
      const mockCoaches = [{ id: 'coach-2', email: 'test@example.com' }];
      const mockExisting = [{ id: 'conn-1', status: 'accepted' }];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coach') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockCoaches, error: null }),
          } as any;
        } else if (table === 'coach_connections') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: mockExisting, error: null }),
          } as any;
        }
        return {} as any;
      });

      await expect(sendConnectionRequest('user-1', 'test@example.com'))
        .rejects.toThrow('You are already connected with this coach');
    });
  });

  describe('respondToConnectionRequest', () => {
    it('should accept connection request', async () => {
      const updateMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: updateMock,
        }),
      } as any);

      await respondToConnectionRequest('conn-1', true);

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('coach_connections');
      expect(updateMock).toHaveBeenCalled();
    });

    it('should decline connection request', async () => {
      const updateMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: updateMock,
        }),
      } as any);

      await respondToConnectionRequest('conn-1', false);

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('coach_connections');
      expect(updateMock).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
        }),
      } as any);

      await expect(respondToConnectionRequest('conn-1', true))
        .rejects.toEqual({ message: 'Update failed' });
    });
  });

  describe('removeConnection', () => {
    it('should remove connection successfully', async () => {
      const deleteMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: deleteMock,
        }),
      } as any);

      await removeConnection('conn-1');

      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('coach_connections');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
        }),
      } as any);

      await expect(removeConnection('conn-1')).rejects.toEqual({ message: 'Delete failed' });
    });
  });

  describe('addCoachToSquad', () => {
    it('should add coach to squad with permissions', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const permissions = {
        can_manage_swimmers: true,
        can_manage_workouts: false,
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: insertMock,
      } as any);

      await addCoachToSquad('squad-1', 'coach-1', 'admin', 'creator-1', permissions);

      expect(insertMock).toHaveBeenCalledWith({
        squad_id: 'squad-1',
        coach_id: 'coach-1',
        role: 'admin',
        created_by: 'creator-1',
        ...permissions,
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } }),
      } as any);

      await expect(addCoachToSquad('squad-1', 'coach-1', 'member', 'creator-1', {}))
        .rejects.toEqual({ message: 'Insert failed' });
    });
  });
});
