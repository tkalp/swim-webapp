import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Filter, 
  Calendar,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { analytics } from '@/lib/mixpanel';
import { useAuth } from '@/contexts/AuthContext';

interface BetaSubmission {
  id: string;
  email: string;
  name: string;
  team_size: string | null;
  current_tools: string | null;
  pain_points: string | null;
  budget_range: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvalRate: number;
}

export default function AdminBetaWaitlist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<BetaSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<BetaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    approvalRate: 0
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  useEffect(() => {
    // Track page view
    analytics.track('Admin Beta Waitlist Viewed', {
      timestamp: new Date().toISOString()
    });

    loadSubmissions();
  }, []);

  useEffect(() => {
    // Filter submissions based on status
    if (statusFilter === 'all') {
      setFilteredSubmissions(submissions);
    } else {
      setFilteredSubmissions(submissions.filter(s => s.status === statusFilter));
    }
  }, [statusFilter, submissions]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('beta_waitlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubmissions(data || []);
      
      // Calculate stats
      const total = data?.length || 0;
      const pending = data?.filter(s => s.status === 'pending').length || 0;
      const approved = data?.filter(s => s.status === 'approved').length || 0;
      const rejected = data?.filter(s => s.status === 'rejected').length || 0;
      const approvalRate = total > 0 ? (approved / total) * 100 : 0;

      setStats({ total, pending, approved, rejected, approvalRate });
      setLoading(false);
    } catch (error) {
      console.error('Error loading beta submissions:', error);
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('beta_waitlist')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', id);

      if (error) throw error;

      // Track status change
      analytics.track('Beta Status Updated', {
        submission_id: id,
        new_status: newStatus,
        timestamp: new Date().toISOString()
      });

      // Reload submissions
      await loadSubmissions();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const saveNotes = async (id: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('beta_waitlist')
        .update({ notes })
        .eq('id', id);

      if (error) throw error;

      analytics.track('Beta Notes Updated', {
        submission_id: id,
        has_notes: !!notes,
        timestamp: new Date().toISOString()
      });

      setEditingNotes(null);
      await loadSubmissions();
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const sendApprovalEmail = async (submission: BetaSubmission) => {
    // TODO: Implement email sending via Supabase Edge Function
    analytics.track('Beta Approval Email Sent', {
      submission_id: submission.id,
      email: submission.email,
      timestamp: new Date().toISOString()
    });
    
    alert(`Approval email would be sent to ${submission.email}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Beta Waitlist Management
          </h1>
          <p className="text-slate-400">Review and manage beta access requests</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-slate-400" />
              <span className="text-slate-400 text-sm">Total</span>
            </div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-slate-400 text-sm">Pending</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-slate-400 text-sm">Approved</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{stats.approved}</div>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-slate-400 text-sm">Rejected</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.rejected}</div>
          </div>

          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span className="text-slate-400 text-sm">Approval Rate</span>
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.approvalRate.toFixed(0)}%</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center gap-3">
          <Filter className="w-5 h-5 text-slate-400" />
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Applicant</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Team Size</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Budget</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Current Tools</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-slate-200">{submission.name}</div>
                        <div className="text-sm text-slate-400">{submission.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{submission.team_size || '—'}</td>
                    <td className="px-6 py-4 text-slate-300">{submission.budget_range || '—'}</td>
                    <td className="px-6 py-4 text-slate-300 max-w-xs truncate">
                      {submission.current_tools || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={submission.status}
                        onChange={(e) => updateStatus(submission.id, e.target.value as any)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusColor(submission.status)} bg-transparent cursor-pointer`}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(submission.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingNotes(submission.id);
                            setNotesValue(submission.notes || '');
                          }}
                          className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                        >
                          Notes
                        </button>
                        {submission.status === 'approved' && (
                          <button
                            onClick={() => sendApprovalEmail(submission)}
                            className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-sm transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredSubmissions.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                No submissions found for this filter.
              </div>
            )}
          </div>
        </div>

        {/* Notes Modal */}
        {editingNotes && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full">
              <h3 className="text-xl font-bold mb-4">Edit Notes</h3>
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                className="w-full h-40 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white resize-none focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                placeholder="Add notes about this submission..."
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => saveNotes(editingNotes, notesValue)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors"
                >
                  Save Notes
                </button>
                <button
                  onClick={() => setEditingNotes(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
