// pages/Squad.tsx
import { useParams, useSearchParams } from 'react-router-dom'
import { useSquadData, type TabKey } from '../hooks/useSquadData'
import { usePermissions } from '../hooks/usePermissions'
import { Shimmer, ErrorToast } from '../components/ui/Loaders'
import SwimmersGrid from '../components/squad/SwimmersGrid'
import SquadWorkouts from '../components/squad/SquadWorkouts'
import { SquadSidebar, SquadMobileNav } from '../components/squad/SquadSidebar'
import { OverviewTab } from '../components/squad/OverviewTab'
import { TrainingTab } from '../components/squad/TrainingTab'
import { SquadCoachesTab } from '../components/squad/SquadCoachesTab'
import { useSwimmerApi } from '../hooks/api'
import type { CreateSwimmerData, UpdateSwimmerData } from '../services/swimmerService'

export default function SquadPage() {
  const { squadId } = useParams<{ squadId: string }>()
  const { squad, swimmers, schedules, sessions, events, loading, err, refetch } = useSquadData(squadId)
  const { hasPermission } = usePermissions(squadId || '')
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) || 'overview'
  
  // Use API hooks with auto-store-sync
  const { createSwimmer, updateSwimmer, deleteSwimmer } = useSwimmerApi()

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
    await refetch()
  }

  return (
    <div className="flex flex-col overflow-hidden">
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
              {tab === 'workouts' && squadId && (
                <SquadWorkouts 
                  squadId={squadId} 
                  canManage={hasPermission('can_manage_workouts')}
                />
              )}
              {tab === 'coaches' && squadId && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <SquadCoachesTab squadId={squadId} />
                </div>
              )}
          </main>

          {/* Mobile Bottom Navigation */}
          <SquadMobileNav activeTab={tab} onTabChange={setTab} />
        </div>
      )}
    </div>
  )
}