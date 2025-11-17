// components/squad/CoachConnections.tsx
import { useState, useEffect } from 'react';
import { UserPlus, Check, X, Clock, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Coach {
  id: string;
  first_name: string;
  last_name: string;
}

interface CoachConnection {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  created_at: string;
  requester?: Coach;
  recipient?: Coach;
}

export function CoachConnections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<CoachConnection[]>([]);
  const [pendingRequests, setPendingRequests] = useState<CoachConnection[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadConnections();
    }
  }, [user?.id]);

  const loadConnections = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get accepted connections
      const { data: acceptedData, error: acceptedError } = await supabase
        .from('coach_connections')
        .select('*')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (acceptedError) throw acceptedError;

      // Get pending requests (where I'm the recipient)
      const { data: pendingData, error: pendingError } = await supabase
        .from('coach_connections')
        .select('*')
        .eq('recipient_id', user.id)
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
      const acceptedWithCoaches = acceptedData?.map(conn => ({
        ...conn,
        requester: coachMap.get(conn.requester_id),
        recipient: coachMap.get(conn.recipient_id),
      })) || [];

      const pendingWithCoaches = pendingData?.map(conn => ({
        ...conn,
        requester: coachMap.get(conn.requester_id),
        recipient: coachMap.get(conn.recipient_id),
      })) || [];

      setConnections(acceptedWithCoaches);
      setPendingRequests(pendingWithCoaches);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendConnectionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !searchEmail.trim()) return;

    try {
      setSending(true);
      setError('');
      setSuccess('');

      // First, find the coach by email
      const { data: coaches, error: searchError } = await supabase
        .from('coach')
        .select('id, email')
        .eq('email', searchEmail.toLowerCase().trim())
        .limit(1);

      if (searchError) throw searchError;

      if (!coaches || coaches.length === 0) {
        setError('No coach found with that email address');
        return;
      }

      const recipientId = coaches[0].id;

      if (recipientId === user.id) {
        setError("You can't send a connection request to yourself");
        return;
      }

      // Check if connection already exists
      const { data: existing } = await supabase
        .from('coach_connections')
        .select('id, status')
        .or(`and(requester_id.eq.${user.id},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${user.id})`)
        .limit(1);

      if (existing && existing.length > 0) {
        if (existing[0].status === 'pending') {
          setError('A connection request is already pending');
        } else if (existing[0].status === 'accepted') {
          setError('You are already connected with this coach');
        } else {
          setError('Cannot send connection request');
        }
        return;
      }

      // Create the connection request
      const { error: insertError } = await supabase
        .from('coach_connections')
        .insert({
          requester_id: user.id,
          recipient_id: recipientId,
          status: 'pending',
        });

      if (insertError) throw insertError;

      setSearchEmail('');
      setSuccess('Connection request sent successfully!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleConnectionResponse = async (connectionId: string, accept: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('coach_connections')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', connectionId);

      if (updateError) throw updateError;

      await loadConnections();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeConnection = async (connectionId: string) => {
    if (!confirm('Remove this connection?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('coach_connections')
        .delete()
        .eq('id', connectionId);

      if (deleteError) throw deleteError;

      await loadConnections();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connect by Email */}
      <div className="bg-background-elevated rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Connect with Coach</h3>
        <form onSubmit={sendConnectionRequest} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Enter coach email address..."
                className="w-full pl-9 pr-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={sending}
              />
            </div>
            <button
              type="submit"
              disabled={!searchEmail.trim() || sending}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <UserPlus size={16} />
              )}
              {sending ? 'Sending...' : 'Connect'}
            </button>
          </div>
          {success && (
            <p className="text-xs text-success">{success}</p>
          )}
          {error && (
            <p className="text-xs text-danger">{error}</p>
          )}
          <p className="text-xs text-text-muted">Enter the email address of the coach you want to connect with</p>
        </form>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-background-elevated rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            Pending Requests ({pendingRequests.length})
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-background-tertiary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                    {request.requester?.first_name?.[0]}{request.requester?.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {request.requester ? `${request.requester.first_name} ${request.requester.last_name}` : `Coach ${request.requester_id.substring(0, 8)}`}
                    </p>
                    <p className="text-xs text-text-muted">ID: {request.requester_id.substring(0, 8)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnectionResponse(request.id, true)}
                    className="p-1.5 bg-success/10 text-success rounded hover:bg-success/20 transition-all"
                    title="Accept"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => handleConnectionResponse(request.id, false)}
                    className="p-1.5 bg-danger/10 text-danger rounded hover:bg-danger/20 transition-all"
                    title="Decline"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Connections */}
      <div className="bg-background-elevated rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          My Connections ({connections.length})
        </h3>
        {connections.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            No connections yet. Enter a coach email above to connect with them.
          </p>
        ) : (
          <div className="space-y-2">
            {connections.map((connection) => {
              const otherCoachId = connection.requester_id === user?.id 
                ? connection.recipient_id 
                : connection.requester_id;
              const otherCoach = connection.requester_id === user?.id
                ? connection.recipient
                : connection.requester;

              return (
                <div key={connection.id} className="flex items-center justify-between p-3 bg-background-tertiary rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {otherCoach?.first_name?.[0]}{otherCoach?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {otherCoach ? `${otherCoach.first_name} ${otherCoach.last_name}` : `Coach ${otherCoachId.substring(0, 8)}`}
                      </p>
                      <p className="text-xs text-text-muted">ID: {otherCoachId.substring(0, 8)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeConnection(connection.id)}
                    className="text-xs text-text-muted hover:text-danger transition-all"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
