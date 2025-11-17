// hooks/useNotifications.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    loadNotifications();

    // Set up real-time subscription for new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'squad_invitations',
          filter: `invited_email=eq.${user.email}`,
        },
        () => {
          loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_connections',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.email]);

  const loadNotifications = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const notificationsList: Notification[] = [];

      // Get pending squad invitations
      const { data: invitations } = await supabase
        .from('squad_invitations')
        .select(`
          *,
          squad:squads(id, name),
          inviter:coach!squad_invitations_inviter_id_fkey(id, first_name, last_name)
        `)
        .eq('invited_email', user.email || '')
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString());

      invitations?.forEach((inv) => {
        notificationsList.push({
          id: `invitation-${inv.id}`,
          type: 'squad_invitation',
          title: 'Squad Invitation',
          message: `${inv.inviter?.first_name} ${inv.inviter?.last_name} invited you to join ${inv.squad?.name}`,
          link: `/squads/${inv.squad_id}`,
          read: false,
          created_at: inv.created_at,
          data: inv,
        });
      });

      // Get pending connection requests
      const { data: connections } = await supabase
        .from('coach_connections')
        .select('*')
        .eq('recipient_id', user.id)
        .eq('status', 'pending');

      // Fetch requester names
      if (connections && connections.length > 0) {
        const requesterIds = connections.map((c) => c.requester_id);
        const { data: coaches } = await supabase
          .from('coach')
          .select('id, first_name, last_name')
          .in('id', requesterIds);

        const coachMap = new Map(coaches?.map((c) => [c.id, c]) || []);

        connections.forEach((conn) => {
          const requester = coachMap.get(conn.requester_id);
          notificationsList.push({
            id: `connection-${conn.id}`,
            type: 'connection_request',
            title: 'Connection Request',
            message: requester
              ? `${requester.first_name} ${requester.last_name} wants to connect with you`
              : `New connection request`,
            link: '/network',
            read: false,
            created_at: conn.created_at,
            data: conn,
          });
        });
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
  };

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
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
