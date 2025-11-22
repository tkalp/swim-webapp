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
      case 'completed': return 'text-success';
      case 'failed': return 'text-danger';
      case 'cancelled': return 'text-text-muted';
      case 'in_progress': return 'text-primary';
      case 'pending': return 'text-warning';
      default: return 'text-text-muted';
    }
  };

  const getStatusBgColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-success/10 border-success/30';
      case 'failed': return 'bg-danger/10 border-danger/30';
      case 'cancelled': return 'bg-background-tertiary/50 border-border';
      case 'in_progress': return 'bg-primary/10 border-primary/30';
      case 'pending': return 'bg-warning/10 border-warning/30';
      default: return 'bg-background-tertiary/50 border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={16} className="text-success" />;
      case 'failed': return <XCircle size={16} className="text-danger" />;
      case 'cancelled': return <XCircle size={16} className="text-text-muted" />;
      case 'in_progress': return <Clock size={16} className="text-primary animate-pulse" />;
      case 'pending': return <Clock size={16} className="text-warning" />;
      default: return null;
    }
  };

  const getProgressPercentage = (job: BulkSyncJob): number => {
    if (job.total_swimmers === 0) return 0;
    return Math.round((job.swimmers_processed / job.total_swimmers) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border-2 border-primary/40 flex items-center justify-center shadow-lg">
            <Shield size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Admin - Bulk Swimmer Sync</h1>
            <p className="text-sm text-text-secondary">Manage SwimRankings data synchronization</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-danger/10 border border-danger rounded-xl p-4 shadow-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <strong className="block text-danger text-sm font-semibold mb-1">Error</strong>
              <p className="text-text-secondary text-sm">{error}</p>
            </div>
            <button
              className="text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Start Sync Section */}
        <section className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <h2 className="text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
            <Play size={20} className="text-primary" />
            Start New Bulk Sync
          </h2>
          <p className="text-text-secondary mb-6 leading-relaxed">
            Sync all swimmers with SwimRankings links. Only stale data (older than 48 hours) will be updated unless forced.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => startBulkSync(false)}
              disabled={isLoading || (currentJob !== null && ['pending', 'in_progress'].includes(currentJob.status))}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Users size={18} />
              <span>{isLoading ? 'Starting...' : 'Sync All Swimmers'}</span>
            </button>
            <button
              onClick={() => startBulkSync(true)}
              disabled={isLoading || (currentJob !== null && ['pending', 'in_progress'].includes(currentJob.status))}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-warning to-warning/80 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-warning/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Zap size={18} />
              <span>Force Full Sync</span>
            </button>
          </div>
        </section>

        {/* Current Job Progress */}
        {currentJob && (
          <section className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <TrendingUp size={20} className="text-primary" />
                Current Sync Job
              </h2>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBgColor(currentJob.status)} border`}>
                {getStatusIcon(currentJob.status)}
                {currentJob.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-text-secondary mb-2 font-medium">
                <span>Progress: {currentJob.swimmers_processed} / {currentJob.total_swimmers} swimmers</span>
                <span className="text-text-primary font-bold">{getProgressPercentage(currentJob)}%</span>
              </div>
              <div className="w-full bg-background-tertiary rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-linear-to-r from-primary to-accent h-3 rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${getProgressPercentage(currentJob)}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-linear-to-br from-success/10 to-success/5 border border-success/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-success mb-1">{currentJob.swimmers_succeeded}</div>
                <div className="text-sm text-text-secondary font-medium">Succeeded</div>
              </div>
              <div className="bg-linear-to-br from-danger/10 to-danger/5 border border-danger/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-danger mb-1">{currentJob.swimmers_failed}</div>
                <div className="text-sm text-text-secondary font-medium">Failed</div>
              </div>
              <div className="bg-linear-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {currentJob.total_swimmers - currentJob.swimmers_processed}
                </div>
                <div className="text-sm text-text-secondary font-medium">Remaining</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {['pending', 'in_progress'].includes(currentJob.status) && (
                <button
                  onClick={() => cancelBulkSync(currentJob.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-danger text-white rounded-lg font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-danger/25"
                >
                  <XCircle size={18} />
                  <span>Cancel Sync</span>
                </button>
              )}
              {currentJob.swimmers_failed > 0 && (
                <button
                  onClick={() => fetchJobFailures(currentJob.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-background-tertiary border border-border text-text-primary rounded-lg font-semibold transition-all duration-200 hover:bg-background-secondary hover:border-primary/30"
                >
                  <AlertCircle size={18} />
                  <span>View Failures ({currentJob.swimmers_failed})</span>
                </button>
              )}
            </div>

            {/* Error Message */}
            {currentJob.error_message && (
              <div className="mt-6 p-4 bg-danger/10 border border-danger/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />
                  <p className="text-sm text-danger font-medium">{currentJob.error_message}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Failures List */}
        {failures.length > 0 && (
          <section className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-danger" />
              Failed Swimmers ({failures.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-background-tertiary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Swimmer</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Error</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Failed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {failures.map((failure, idx) => (
                    <tr key={idx} className="hover:bg-background-tertiary/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-text-primary whitespace-nowrap">
                        {failure.swimmer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {failure.error_message}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
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
        <section className="bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            Sync History
          </h2>
          {jobHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-linear-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Clock size={32} className="text-primary" />
              </div>
              <p className="text-text-secondary">No sync jobs yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-background-tertiary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Started</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Succeeded</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Failed</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {jobHistory.map((job) => (
                    <tr key={job.id} className="hover:bg-background-tertiary/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
                        {job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBgColor(job.status)} border`}>
                          {getStatusIcon(job.status)}
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary font-semibold whitespace-nowrap">
                        {job.total_swimmers}
                      </td>
                      <td className="px-4 py-3 text-sm text-success font-semibold whitespace-nowrap">
                        {job.swimmers_succeeded}
                      </td>
                      <td className="px-4 py-3 text-sm text-danger font-semibold whitespace-nowrap">
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
                          className="text-primary hover:text-accent font-semibold text-sm transition-colors"
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
