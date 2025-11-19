import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSquadPermissions } from "../hooks/useSquadPermissions";
import { getSwimmerSyncStatus, type SwimmerSyncStatus } from "../services/swimmerService";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";

import AttendanceChart from "../components/charts/AttendanceChart";
import SessionsPerWeekChart from "../components/charts/SessionsPerWeekChart";
import SwimmerOverviewStats from "../components/stats/SwimmerOverviewStats";
import RangeToolbar from "../components/range/RangeToolbar";
import BestTimesTab from "../components/swimmers/BestTimesTab";
import FinaPointsTab from "../components/swimmers/FinaPointsTab";
import SwimRankingsLink from "../components/swimmers/SwimRankingsLink";

import type { RangeKey } from "../types/stats";
import { useSwimmerStats } from "../hooks/useSwimmerStats";
import { presetRange, formatRangeSubtitle } from "../utils/dateRanges";
import PageHeader from "../components/ui/PageHeader";


const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'bestTimes', label: 'Best Times' },
  { key: 'finaPoints', label: 'FINA Points' },
];

export default function SwimmerPage() {
  const { swimmerId } = useParams<{ swimmerId: string }>();

  // range state
  const [rangeKey, setRangeKey] = useState<RangeKey>("all_time");
  const initial = presetRange("all_time");
  const [from, setFrom] = useState<string | undefined>(initial.from);
  const [to, setTo] = useState<string | undefined>(initial.to);

  // data
  const {
    loading,
    err,
    attendance,
    sessions,
    totalAttendance,
    presentPct,
    attendanceData,
    avgPerWeek,
    bestWeek,
    swimmer,
  } = useSwimmerStats(swimmerId, { from, to });

  // Fetch squad_id from swimmer to check permissions
  const [squadId, setSquadId] = useState<string | null>(null);
  const { hasPermission } = useSquadPermissions(squadId || '');
  const [syncStatus, setSyncStatus] = useState<SwimmerSyncStatus | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const externalLinkIdRef = useRef<string | null>(null);

  // Set squad ID when swimmer loads
  useEffect(() => {
    if (swimmer?.squad_id) {
      setSquadId(swimmer.squad_id);
    }
  }, [swimmer?.squad_id]);

  // Initialize sync status from swimmer data (runs once when swimmer first loads)
  useEffect(() => {
    if (!swimmer?.external_links || swimmer.external_links.length === 0) {
      return;
    }

    const swimRankingsLink = swimmer.external_links.find(
      (link: any) => link.platform === 'swimrankings'
    );
    
    if (swimRankingsLink) {
      // Only set initial sync status and external link ID
      setSyncStatus(swimRankingsLink);
      externalLinkIdRef.current = swimRankingsLink.id;
    }
  }, [swimmer?.id]); // Only re-run if swimmer ID changes (new swimmer loaded)

  // Separate effect for polling that doesn't depend on swimmer object
  useEffect(() => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Only start polling if we have a link ID and status is pending/in_progress
    if (externalLinkIdRef.current && syncStatus && 
        (syncStatus.sync_status === 'pending' || syncStatus.sync_status === 'in_progress')) {
      
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await getSwimmerSyncStatus(externalLinkIdRef.current!);
          setSyncStatus(status);
          
          // Stop polling if completed or failed
          if (status.sync_status === 'completed' || status.sync_status === 'failed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (error) {
          console.error('Error polling sync status:', error);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }, 2000);
    }

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };  }, [syncStatus?.sync_status]); // Only depend on sync_status value, not whole object

  // Handler for when manual sync is triggered
  const handleSyncTrigger = () => {
    if (externalLinkIdRef.current) {
      // Immediately update status to pending
      setSyncStatus(prev => prev ? {
        ...prev,
        sync_status: 'pending',
        last_sync_started_at: new Date().toISOString()
      } : null);
    }
  };

  // Handler for cancelling sync
  const handleCancelSync = async () => {
    if (!swimmer?.id) return;
    
    try {
      const { cancelSwimmerSync } = await import('../services/swimmerService');
      await cancelSwimmerSync(swimmer.id);
      
      // Update status to reflect cancellation
      setSyncStatus(prev => prev ? {
        ...prev,
        sync_status: 'cancelled',
        sync_error: 'Cancelled by user'
      } : null);
    } catch (error) {
      console.error('Failed to cancel sync:', error);
    }
  };
  
  // UI state
  const [tab, setTab] = useState("overview");

  const rangeSubtitle = useMemo(
    () => formatRangeSubtitle(from, to),
    [from, to]
  );

  // handlers
  const onQuick = (key: RangeKey) => {
    setRangeKey(key);
    const p = presetRange(key);
    setFrom(p.from);
    setTo(p.to);
  };
  const onApplyCustom = () => setRangeKey("custom");

  // Show loading screen until swimmer data is loaded
  if (loading || !swimmer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full animate-pulse">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">Loading Swimmer Data</h2>
            <p className="text-sm text-text-secondary">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      <PageHeader
        title={
          swimmer ? (
            <div className="flex flex-col gap-2">
              <span>{swimmer.first_name} {swimmer.last_name}</span>
              <div className="flex items-center gap-2">
                {swimmer.date_of_birth && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-md border border-primary/20">
                    <span className="text-xs font-medium text-primary">
                      {(() => {
                        const today = new Date();
                        const birthDate = new Date(swimmer.date_of_birth);
                        let age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                          age--;
                        }
                        return age;
                      })()} years
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 rounded-md border border-accent/20">
                  <span className="text-xs font-medium text-accent">
                    {swimmer.sex === "Female" ? "Female" : "Male"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            "Swimmer Stats"
          )
        }
        backLabel="Swimmers"
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        rightContent={
          swimmer && (
            <SwimRankingsLink
              swimmerId={swimmerId!}
              firstName={swimmer.first_name}
              lastName={swimmer.last_name}
              onSyncTrigger={handleSyncTrigger}
              syncStatus={syncStatus?.sync_status}
            />
          )
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
        {/* Sync Status Banner */}
        {syncStatus && (syncStatus.sync_status === 'pending' || syncStatus.sync_status === 'in_progress' || syncStatus.sync_status === 'failed') && (
          <div className={`p-4 rounded-xl border ${
            syncStatus.sync_status === 'failed'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            <div className="flex items-center gap-3">
              {syncStatus.sync_status === 'pending' || syncStatus.sync_status === 'in_progress' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {syncStatus.sync_status === 'pending' ? 'Preparing to import data...' : 'Importing swimmer data...'}
                    </p>
                    {syncStatus.sync_progress !== undefined && syncStatus.sync_total !== undefined && syncStatus.sync_total > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{syncStatus.sync_progress} / {syncStatus.sync_total} events processed</span>
                          <span>{Math.round((syncStatus.sync_progress / syncStatus.sync_total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-blue-500/20 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full transition-all duration-300 ease-out"
                            style={{ width: `${(syncStatus.sync_progress / syncStatus.sync_total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleCancelSync}
                    className="px-3 py-1.5 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" />
                  <p className="font-semibold">Data import failed</p>
                  {syncStatus.sync_error && (
                    <p className="text-sm opacity-80 ml-2">{syncStatus.sync_error}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        
        {err && (
          <div className="fixed top-20 right-4 sm:right-6 bg-background-elevated border border-danger rounded-xl p-3 shadow-lg flex items-start gap-2 max-w-[90vw] sm:max-w-md z-[1000] animate-in slide-in-from-right duration-300">
            <div className="flex-1">
              <strong className="block text-danger text-sm font-semibold mb-1">
                Error
              </strong>
              <p className="m-0 text-text-secondary text-xs leading-relaxed break-words">
                {err}
              </p>
            </div>
          </div>
        )}

        {tab === "overview" && (
          <div className="space-y-3">
            <RangeToolbar
              rangeKey={rangeKey}
              from={from}
              to={to}
              onQuick={onQuick}
              onChangeFrom={setFrom}
              onChangeTo={setTo}
              onApplyCustom={onApplyCustom}
            />

            {loading && (
              <div className="space-y-3">
                {/* Loading skeleton for stats */}
                <div className="flex flex-wrap gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex-1 min-w-[150px] p-4 bg-background-elevated rounded-xl border border-border/60 animate-pulse">
                      <div className="h-3 bg-background-tertiary rounded mb-2"></div>
                      <div className="h-6 bg-background-tertiary rounded mb-2"></div>
                      <div className="h-2 w-2/3 bg-background-tertiary rounded"></div>
                    </div>
                  ))}
                </div>
                
                {/* Loading skeleton for charts */}
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="flex-1 p-4 bg-background-elevated rounded-xl border border-border/60 animate-pulse">
                    <div className="h-5 bg-background-tertiary rounded mb-3"></div>
                    <div className="h-48 bg-background-tertiary rounded"></div>
                  </div>
                  <div className="flex-1 p-4 bg-background-elevated rounded-xl border border-border/60 animate-pulse">
                    <div className="h-5 bg-background-tertiary rounded mb-3"></div>
                    <div className="h-48 bg-background-tertiary rounded"></div>
                  </div>
                </div>
              </div>
            )}

            {!loading && (
              <div className="space-y-3">
                <SwimmerOverviewStats
                  presentPct={presentPct}
                  attendance={attendance}
                  totalAttendance={totalAttendance}
                  avgPerWeek={avgPerWeek}
                  weeksInRange={sessions.length}
                />

                <div className="flex flex-col xl:flex-row gap-3">
                  <div className="flex-1 bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                    <AttendanceChart
                      data={attendanceData}
                      subtitle={rangeSubtitle}
                    />
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                    <SessionsPerWeekChart data={sessions} bestWeek={bestWeek} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && tab === "bestTimes" && swimmerId && (
          <div className="animate-in fade-in slide-in-from-bottom duration-500">
            <BestTimesTab 
              swimmerId={swimmerId} 
              swimmer={swimmer}
              canManageResults={hasPermission('can_manage_results')}
            />
          </div>
        )}

        {!loading && tab === "finaPoints" && swimmerId && (
          <div className="animate-in fade-in slide-in-from-bottom duration-500">
            <FinaPointsTab 
              swimmerId={swimmerId} 
              swimmer={swimmer}
            />
          </div>
        )}
      </main>
    </div>
  );
}
