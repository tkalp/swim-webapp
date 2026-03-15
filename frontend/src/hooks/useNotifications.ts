// hooks/useNotifications.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  type: 'squad_invitation' | 'connection_request' | 'connection_accepted';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
  data?: any;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const rawNotifications = await apiClient.get<any[]>('/notifications/all');
      const notificationsList: Notification[] = [];

      for (const item of rawNotifications) {
        if (item.type === 'invitation') {
          notificationsList.push({
            id: `invitation-${item.id}`,
            type: 'squad_invitation',
            title: 'Squad Invitation',
            message: item.squad?.name
              ? `You've been invited to join ${item.squad.name}`
              : 'New squad invitation',
            link: `/squads/${item.squad_id}`,
            read: item.read === true,
            created_at: item.created_at,
            data: item,
          });
        } else if (item.type === 'connection_request') {
          const requester = item.requester;
          notificationsList.push({
            id: `connection-${item.id}`,
            type: 'connection_request',
            title: 'Connection Request',
            message: requester
              ? `${requester.first_name} ${requester.last_name} wants to connect with you`
              : 'New connection request',
            link: '/network',
            read: item.read === true,
            created_at: item.created_at,
            data: item,
          });
        }
      }

      // Sort by date (newest first)
      notificationsList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(notificationsList);
      setUnreadCount(notificationsList.filter((n) => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    loadNotifications();

    // Poll for new notifications (no WebSocket real-time)
    intervalRef.current = setInterval(loadNotifications, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user?.id, loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    // Optimistically update local state
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Persist to backend
    try {
      // notificationId is like "invitation-<uuid>" or "connection-<uuid>"
      const dashIdx = notificationId.indexOf('-');
      const prefix = notificationId.slice(0, dashIdx);
      const rawId = notificationId.slice(dashIdx + 1);

      const notificationType = prefix === 'invitation' ? 'invitation' : 'connection_request';

      await apiClient.put(`/notifications/${rawId}/read?notification_type=${notificationType}`, {});
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // On failure, revert the optimistic update by reloading
      loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    // Optimistically update local state
    const unread = notifications.filter((n) => !n.read);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    // Persist each unread notification to backend
    await Promise.allSettled(
      unread.map(async (n) => {
        try {
          const dashIdx = n.id.indexOf('-');
          const prefix = n.id.slice(0, dashIdx);
          const rawId = n.id.slice(dashIdx + 1);
          const notificationType = prefix === 'invitation' ? 'invitation' : 'connection_request';
          await apiClient.put(`/notifications/${rawId}/read?notification_type=${notificationType}`, {});
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      })
    );
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    reload: loadNotifications,
  };
}
