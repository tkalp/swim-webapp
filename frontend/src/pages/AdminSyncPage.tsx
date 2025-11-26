import React, { useState, useEffect } from 'react';
import {
  Shield,
  Play,
  Zap,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  startBulkSync as startBulkSyncAPI,
  getBulkSyncStatus,
  getBulkSyncFailures,
  cancelBulkSync as cancelBulkSyncAPI,
  getBulkSyncHistory,
  type BulkSyncJob,
  type BulkSyncFailure,
} from '@/services/adminService';

const AdminSyncPage: React.FC = () => {
  const [currentJob, setCurrentJob] = useState<BulkSyncJob | null>(null);
  const [jobHistory, setJobHistory] = useState<BulkSyncJob[]>([]);
  const [failures, setFailures] = useState<BulkSyncFailure[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sync history on mount
  useEffect(() => {
    fetchSyncHistory();
  }, []);

  // Poll for job updates when a job is active
  useEffect(() => {
    if (currentJob && ['pending', 'in_progress'].includes(currentJob.status)) {
      const interval = setInterval(() => {
        fetchJobStatus(currentJob.id);
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [currentJob]);

  const fetchSyncHistory = async () => {
    try {
      const history = await getBulkSyncHistory();
      setJobHistory(history);
    } catch (err: any) {
      console.error('Failed to fetch sync history:', err);
      setError(err.message || 'Failed to fetch sync history');
    }
  };

  const fetchJobStatus = async (jobId: string) => {
    try {
      const job = await getBulkSyncStatus(jobId);
      setCurrentJob(job);

      // If job completed, refresh history
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        fetchSyncHistory();
      }
    } catch (err: any) {
      console.error('Failed to fetch job status:', err);
    }
  };

  const fetchJobFailures = async (jobId: string) => {
    try {
      const failuresList = await getBulkSyncFailures(jobId);
      setFailures(failuresList);
    } catch (err: any) {
      console.error('Failed to fetch failures:', err);
    }
  };

  const startBulkSync = async (forceUpdate: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await startBulkSyncAPI(forceUpdate);

      if (response.success) {
        // Task queued successfully - the job will appear in history via polling
        setCurrentJob(null);
        // Refresh history to show the new job when it's created
        setTimeout(() => fetchSyncHistory(), 2000); // Give it 2 seconds to create the job
      } else {
        setError(response.error || 'Failed to start bulk sync');
      }
    } catch (err: any) {
      console.error('Failed to start bulk sync:', err);
      setError(err.message || 'Failed to start bulk sync');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBulkSync = async (jobId: string) => {
    try {
      await cancelBulkSyncAPI(jobId);
      await fetchJobStatus(jobId);
    } catch (err: any) {
      console.error('Failed to cancel bulk sync:', err);
      setError(err.message || 'Failed to cancel bulk sync');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'cancelled': return 'text-slate-500';
      case 'in_progress': return 'text-cyan-400';
      case 'pending': return 'text-orange-400';
      default: return 'text-slate-500';
    }
  };

  const getStatusBgColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 border-green-500/30';
      case 'failed': return 'bg-red-500/10 border-red-500/30';
      case 'cancelled': return 'bg-slate-800/50 border-slate-700';
      case 'in_progress': return 'bg-cyan-500/10 border-cyan-500/30';
      case 'pending': return 'bg-orange-500/10 border-orange-500/30';
      default: return 'bg-slate-800/50 border-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={16} className="text-green-400" />;
      case 'failed': return <XCircle size={16} className="text-red-400" />;
      case 'cancelled': return <XCircle size={16} className="text-slate-500" />;
      case 'in_progress': return <Clock size={16} className="text-cyan-400 animate-pulse" />;
      case 'pending': return <Clock size={16} className="text-orange-400" />;
      default: return null;
    }
  };

  const getProgressPercentage = (job: BulkSyncJob): number => {
    if (job.total_swimmers === 0) return 0;
    return Math.round((job.swimmers_processed / job.total_swimmers) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/30 via-blue-500/40 to-cyan-500/30 border-2 border-cyan-500/40 flex items-center justify-center shadow-lg">
            <Shield size={24} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Admin - Bulk Swimmer Sync</h1>
            <p className="text-sm text-slate-400">Manage SwimRankings data synchronization</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 shadow-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <strong className="block text-red-400 text-sm font-semibold mb-1">Error</strong>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
            <button
              className="text-slate-500 hover:text-slate-100 transition-colors"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Start Sync Section */}
        <section className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <h2 className="text-xl font-bold text-slate-100 mb-3 flex items-center gap-2">
            <Play size={20} className="text-cyan-400" />
            Start New Bulk Sync
          </h2>
          <p className="text-slate-400 mb-6 leading-relaxed">
            Sync all swimmers with SwimRankings links. Only stale data (older than 48 hours) will be updated unless forced.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => startBulkSync(false)}
              disabled={isLoading || (currentJob !== null && ['pending', 'in_progress'].includes(currentJob.status))}
              className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Users size={18} />
              <span>{isLoading ? 'Starting...' : 'Sync All Swimmers'}</span>
            </button>
            <button
              onClick={() => startBulkSync(true)}
              disabled={isLoading || (currentJob !== null && ['pending', 'in_progress'].includes(currentJob.status))}
              className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-orange-500 to-orange-400 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Zap size={18} />
              <span>Force Full Sync</span>
            </button>
          </div>
        </section>

        {/* Current Job Progress */}
        {currentJob && (
          <section className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp size={20} className="text-cyan-400" />
                Current Sync Job
              </h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBgColor(currentJob.status)} border`}>
                {getStatusIcon(currentJob.status)}
                {currentJob.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-slate-400 mb-2 font-medium">
                <span>Progress: {currentJob.swimmers_processed} / {currentJob.total_swimmers} swimmers</span>
                <span className="text-slate-100 font-bold">{getProgressPercentage(currentJob)}%</span>
              </div>
              <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-linear-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${getProgressPercentage(currentJob)}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-linear-to-br from-green-500/10 to-green-500/5 border border-green-500/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400 mb-1">{currentJob.swimmers_succeeded}</div>
                <div className="text-sm text-slate-400 font-medium">Succeeded</div>
              </div>
              <div className="bg-linear-to-br from-red-500/10 to-red-500/5 border border-red-500/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-400 mb-1">{currentJob.swimmers_failed}</div>
                <div className="text-sm text-slate-400 font-medium">Failed</div>
              </div>
              <div className="bg-linear-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  {currentJob.total_swimmers - currentJob.swimmers_processed}
                </div>
                <div className="text-sm text-slate-400 font-medium">Remaining</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {['pending', 'in_progress'].includes(currentJob.status) && (
                <button
                  onClick={() => cancelBulkSync(currentJob.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-lg font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25"
                >
                  <XCircle size={18} />
                  <span>Cancel Sync</span>
                </button>
              )}
              {currentJob.swimmers_failed > 0 && (
                <button
                  onClick={() => fetchJobFailures(currentJob.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800/50 border border-slate-700 text-slate-100 rounded-lg font-semibold transition-all duration-200 hover:bg-slate-800 hover:border-cyan-500/30"
                >
                  <AlertCircle size={18} />
                  <span>View Failures ({currentJob.swimmers_failed})</span>
                </button>
              )}
            </div>

            {/* Error Message */}
            {currentJob.error_message && (
              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400 font-medium">{currentJob.error_message}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Failures List */}
        {failures.length > 0 && (
          <section className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-red-400" />
              Failed Swimmers ({failures.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Swimmer</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Error</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Failed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {failures.map((failure, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-100 whitespace-nowrap">
                        {failure.swimmer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {failure.error_message}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {new Date(failure.failed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Sync History */}
        <section className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-cyan-400" />
            Sync History
          </h2>
          {jobHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Clock size={32} className="text-cyan-400" />
              </div>
              <p className="text-slate-400">No sync jobs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Started</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Succeeded</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Failed</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {jobHistory.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-100 whitespace-nowrap">
                        {job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBgColor(job.status)} border`}>
                          {getStatusIcon(job.status)}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-100 font-semibold whitespace-nowrap">
                        {job.total_swimmers}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-400 font-semibold whitespace-nowrap">
                        {job.swimmers_succeeded}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-400 font-semibold whitespace-nowrap">
                        {job.swimmers_failed}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setCurrentJob(job);
                            if (job.swimmers_failed > 0) {
                              fetchJobFailures(job.id);
                            }
                          }}
                          className="text-cyan-400 hover:text-blue-400 font-semibold text-sm transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminSyncPage;
