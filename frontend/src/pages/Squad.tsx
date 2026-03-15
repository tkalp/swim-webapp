// pages/Squad.tsx
import { useParams, useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { Shimmer, ErrorToast } from '@/components/ui/Loaders'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import SwimmersGrid from '@/components/squad/SwimmersGrid'
import { SquadSidebar, SquadMobileNav } from '@/components/squad/SquadSidebar'
import { OverviewTab } from '@/components/squad/OverviewTab'
import { TrainingTab } from '@/components/squad/TrainingTab'
import { SquadCoachesTab } from '@/components/squad/SquadCoachesTab'
import { ScheduleTab } from '@/components/squad/ScheduleTab'
import { useSwimmerApi } from '@/hooks/api'
import { useSquadDetails, useSwimmersBySquad, useSquadSchedules, useSquadSessions, useSquadEvents } from '@/hooks/useStores'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { getSquadById, getSquadSwimmers, getSquadSchedules, getSquadSessions, getSquadCalendarEvents, triggerSquadSync, getSquadSyncStatus } from '@/services/squadService'
import type { SquadSyncStatus } from '@/services/squadService'
import { useSquadStore } from '@/stores/squadStore'
import { useSwimmerStore } from '@/stores/swimmerStore'
import type { CreateSwimmerData, UpdateSwimmerData } from '@/services/swimmerService'

export type TabKey = 'overview' | 'team' | 'training' | 'schedule' | 'coaches'

export default function SquadPage() {
  const { squadId } = useParams<{ squadId: string }>()
  const { hasPermission } = usePermissions(squadId || '')
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) || 'overview'
  
  // Get data from stores
  const squad = useSquadDetails(squadId ?? null)
  const swimmers = useSwimmersBySquad(squadId ?? null)
  const schedules = useSquadSchedules(squadId ?? null)
  const sessions = useSquadSessions(squadId ?? null)
  const events = useSquadEvents(squadId ?? null)
  
  // Local loading state
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string>('')
  
  // Squad sync state
  const [syncStatus, setSyncStatus] = useState<SquadSyncStatus | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncError, setSyncError] = useState('')
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isSyncing = syncStatus?.status === 'in_progress' || syncStatus?.status === 'pending'

  const refreshRef = useRef<() => void>(() => {})

  const stopPolling = useCallback(() => {
    if (syncPollRef.current) {
      clearInterval(syncPollRef.current)
      syncPollRef.current = null
    }
  }, [])

  const startPolling = useCallback((jobId: string) => {
    if (!squadId) return
    stopPolling()

    syncPollRef.current = setInterval(async () => {
      try {
        const status = await getSquadSyncStatus(squadId, jobId)
        setSyncStatus(status)

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          stopPolling()
          if (status.status === 'completed') {
            refreshRef.current()
          }
        }
      } catch {
        // Silently retry — polling will continue
      }
    }, 2000)
  }, [squadId, stopPolling])

  const handleSyncSquad = async () => {
    if (!squadId || syncLoading || isSyncing) return
    setSyncLoading(true)
    setSyncError('')
    setSyncStatus(null)

    try {
      const res = await triggerSquadSync(squadId)
      if (!res.success) {
        setSyncError(res.message || 'Failed to start sync')
        setSyncLoading(false)
        return
      }

      // Set initial status and start polling
      setSyncStatus({
        id: res.job_id || '',
        status: 'in_progress',
        total_swimmers: res.total_swimmers ?? 0,
        swimmers_processed: 0,
        swimmers_succeeded: 0,
        swimmers_failed: 0,
      })
      setSyncLoading(false)

      if (res.job_id) {
        startPolling(res.job_id)
      }
    } catch (e: any) {
      setSyncError(e.message || 'Failed to start sync')
      setSyncLoading(false)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // Use API hooks with auto-store-sync
  const { createSwimmer, updateSwimmer, deleteSwimmer } = useSwimmerApi()
  
  // Load squad data on mount
  useEffect(() => {
    if (!squadId) return
    
    let mounted = true
    setLoading(true)
    setErr('')
    
    ;(async () => {
      try {
        const [sq, sw, sc, ss, ev] = await Promise.all([
          getSquadById(squadId),
          getSquadSwimmers(squadId),
          getSquadSchedules(squadId),
          getSquadSessions(squadId),
          getSquadCalendarEvents(squadId),
        ])
        
        if (!mounted) return
        
        // Update stores
        const { setSquadDetails, setSchedules, setSessions, setEvents } = useSquadStore.getState()
        const { setSwimmers } = useSwimmerStore.getState()
        
        if (sq) setSquadDetails(squadId, sq)
        setSwimmers(sw || [], squadId)
        setSchedules(squadId, sc || [])
        setSessions(squadId, ss || [])
        setEvents(squadId, ev || [])
        
        setLoading(false)
      } catch (error: any) {
        if (!mounted) return
        setErr(error.message || 'Failed to load squad data')
        setLoading(false)
      }
    })()
    
    return () => {
      mounted = false
    }
  }, [squadId])

  const setTab = (t: TabKey) => {
    params.set('tab', t)
    setParams(params, { replace: true })
  }

  // Swimmer CRUD handlers - now using API hooks that auto-update the store
  const handleAddSwimmer = async (swimmerData: CreateSwimmerData) => {
    if (!squadId) throw new Error('Squad ID is required')
    
    const newSwimmer = await createSwimmer({
      ...swimmerData,
      squad_id: squadId
    })
    
    // Return the created swimmer so modal can use its ID
    return newSwimmer
  }

  const handleEditSwimmer = async (swimmerId: string, updates: UpdateSwimmerData) => {
    await updateSwimmer(swimmerId, updates)
    // No need to reload - store is automatically updated!
  }

  const handleDeleteSwimmer = async (swimmerId: string) => {
    await deleteSwimmer(swimmerId)
    // No need to reload - store is automatically updated!
  }

  const handleRefresh = async () => {
    if (!squadId) return

    try {
      const [sq, sw, sc, ss, ev] = await Promise.all([
        getSquadById(squadId),
        getSquadSwimmers(squadId),
        getSquadSchedules(squadId),
        getSquadSessions(squadId),
        getSquadCalendarEvents(squadId),
      ])
      
      // Update stores
      const { setSquadDetails, setSchedules, setSessions, setEvents } = useSquadStore.getState()
      const { setSwimmers } = useSwimmerStore.getState()
      
      if (sq) setSquadDetails(squadId, sq)
      setSwimmers(sw || [], squadId)
      setSchedules(squadId, sc || [])
      setSessions(squadId, ss || [])
      setEvents(squadId, ev || [])
    } catch (error: any) {
      setErr(error.message || 'Failed to refresh squad data')
    }
  }

  // Keep ref in sync so polling callback always calls the latest version
  refreshRef.current = handleRefresh

  // Build breadcrumb based on current tab
  const getTabLabel = (tab: TabKey): string => {
    const labels: Record<TabKey, string> = {
      overview: 'Overview',
      team: 'Team',
      training: 'Training',
      schedule: 'Schedule',
      coaches: 'Coaches'
    }
    return labels[tab]
  }

  return (
    <div className="flex flex-col overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Error Toast */}
      {err && <ErrorToast msg={err} />}

      {/* Loading State */}
      {loading && <Shimmer />}

      {/* Main Content with Sidebar */}
      {!loading && (
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar Navigation */}
          <SquadSidebar activeTab={tab} onTabChange={setTab} />

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0">
            {/* Breadcrumb Navigation */}
            <div className="shrink-0 bg-slate-900/50 backdrop-blur-xl border-b border-slate-800/60 px-6 py-4">
              <div className="flex items-center justify-between">
                <Breadcrumb
                  items={[
                    { label: 'Squads', href: '/squads' },
                    { label: squad?.name || 'Loading...', href: `/squads/${squadId}` },
                    { label: getTabLabel(tab) }
                  ]}
                />

                {/* Sync Squad Button */}
                <div className="flex items-center gap-3">
                  {syncError && (
                    <span className="text-xs text-red-400">{syncError}</span>
                  )}

                  {isSyncing && syncStatus && (
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${syncStatus.total_swimmers > 0 ? (syncStatus.swimmers_processed / syncStatus.total_swimmers) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {syncStatus.swimmers_processed}/{syncStatus.total_swimmers}
                      </span>
                    </div>
                  )}

                  {syncStatus?.status === 'completed' && !isSyncing && (
                    <span className="text-xs text-emerald-400">
                      Synced {syncStatus.swimmers_succeeded}/{syncStatus.total_swimmers}
                    </span>
                  )}

                  {syncStatus?.status === 'failed' && !isSyncing && (
                    <span className="text-xs text-red-400">Sync failed</span>
                  )}

                  <button
                    onClick={handleSyncSquad}
                    disabled={syncLoading || isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Squad'}
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {tab === 'overview' && squadId && <OverviewTab squadId={squadId} />}
              {tab === 'team' && squadId && (
                <SwimmersGrid 
                  swimmers={swimmers} 
                  squadId={squadId}
                  canManage={hasPermission('can_manage_swimmers')}
                  onAddSwimmer={handleAddSwimmer}
                  onEditSwimmer={handleEditSwimmer}
                  onDeleteSwimmer={handleDeleteSwimmer}
                />
              )}
              {tab === 'training' && squadId && (
                <TrainingTab 
                  squadId={squadId}
                  schedules={schedules || []}
                  sessions={sessions || []}
                  events={events || []}
                  canManageSessions={hasPermission('can_manage_schedules')}
                  canManageSchedules={hasPermission('can_manage_schedules')}
                  canManageAttendance={hasPermission('can_manage_attendance')}
                  onRefresh={handleRefresh}
                />
              )}
              {tab === 'schedule' && squadId && (
                <ScheduleTab 
                  squadId={squadId}
                  canManage={hasPermission('can_manage_schedules')}
                />
              )}
              {tab === 'coaches' && squadId && (
                <SquadCoachesTab squadId={squadId} />
              )}
            </div>
          </main>

          {/* Mobile Bottom Navigation */}
          <SquadMobileNav activeTab={tab} onTabChange={setTab} />
        </div>
      )}
    </div>
  )
}