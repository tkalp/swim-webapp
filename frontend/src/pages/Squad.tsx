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
import { useSwimmerApi } from '@/hooks/api'
import { useSquadDetails, useSwimmersBySquad, useSquadSchedules, useSquadSessions, useSquadEvents } from '@/hooks/useStores'
import { useState, useEffect } from 'react'
import { getSquadById, getSquadSwimmers, getSquadSchedules, getSquadSessions, getSquadCalendarEvents } from '@/services/squadService'
import { useSquadStore } from '@/stores/squadStore'
import { useSwimmerStore } from '@/stores/swimmerStore'
import type { CreateSwimmerData, UpdateSwimmerData } from '@/services/swimmerService'

export type TabKey = 'overview' | 'team' | 'training' | 'coaches'

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

  // Build breadcrumb based on current tab
  const getTabLabel = (tab: TabKey): string => {
    const labels: Record<TabKey, string> = {
      overview: 'Overview',
      team: 'Team',
      training: 'Training',
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
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <SquadSidebar activeTab={tab} onTabChange={setTab} />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
            {/* Breadcrumb Navigation */}
            <div className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800/60 px-6 py-4">
              <Breadcrumb 
                items={[
                  { label: 'Squads', href: '/squads' },
                  { label: squad?.name || 'Loading...', href: `/squads/${squadId}` },
                  { label: getTabLabel(tab) }
                ]}
              />
            </div>

            {/* Tab Content */}
            <div className="p-6">
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
                  canManageSessions={hasPermission('can_manage_sessions')}
                  canManageSchedules={hasPermission('can_manage_schedules')}
                  canManageAttendance={hasPermission('can_manage_attendance')}
                  onRefresh={handleRefresh}
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