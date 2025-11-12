// pages/Squad.tsx
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Waves, Users } from 'lucide-react'
import { useSquadData, type TabKey } from '../hooks/useSquadData'
import { Tabs } from '../components/ui/Tabs'
import { Shimmer, ErrorToast } from '../components/ui/Loaders'
import SwimmersGrid from '../components/squad/SwimmersGrid'
import SessionsList from '../components/squad/SessionsList'
import CalendarMonth from '../components/squad/CalenderMonth'
import SquadMetricsTab from '../components/squad/SquadMetrics'
import SquadRankings from '../components/squad/SquadRankings'
import { createSwimmer, updateSwimmer, deleteSwimmer, type CreateSwimmerData, type UpdateSwimmerData } from '../services/swimmerService'
import '@/styles/Squad.css'
import WeeklyScheduleView from '../components/squad/WeeklyScheduleView'

const TAB_ITEMS = ['metrics', 'rankings', 'swimmers', 'schedule', 'sessions', 'calendar'] as const

export default function SquadPage() {
  const { squadId } = useParams<{ squadId: string }>()
  const { squad, swimmers, schedules, sessions, events, loading, err } = useSquadData(squadId)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) || 'metrics'

  const setTab = (t: TabKey) => {
    params.set('tab', t)
    setParams(params, { replace: true })
  }

  // Swimmer CRUD handlers
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
    
    // Reload to show updated data
    window.location.reload()
  }

  const handleDeleteSwimmer = async (swimmerId: string) => {
    await deleteSwimmer(swimmerId)
    
    // For now, we'll let the parent component handle the refetch
    window.location.reload()
  }

  return (
    <div className="squad-page">
      {/* Header */}
      <header className="sticky top-0 z-[100] bg-background-elevated/95 backdrop-blur-xl border-b border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Logo and Breadcrumbs */}
            <div className="flex items-center gap-3 sm:gap-4 text-base w-full sm:w-auto">
              {/* Logo */}
              <Link
                to="/"
                className="flex items-center gap-2 cursor-pointer transition-all hover:scale-105 bg-transparent border-none p-0"
                title="Home"
              >
                <Waves size={24} className="text-primary" />
                <span className="hidden md:inline text-lg font-bold bg-gradient-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
                  aquilus
                </span>
              </Link>

              <span className="text-border text-xl hidden sm:inline">/</span>
              
              <Link 
                to="/squads" 
                className="flex items-center gap-2 text-text-secondary hover:text-primary bg-transparent border-none font-semibold cursor-pointer transition-all px-3 py-2 rounded-lg hover:bg-primary/10 hover:scale-105"
              >
                <ArrowLeft size={18} />
                <span className="hidden sm:inline">Squads</span>
              </Link>
              
              <span className="text-border text-xl hidden sm:inline">/</span>
              
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border border-primary/40 flex items-center justify-center shadow-md">
                  <Users size={16} className="text-primary" />
                </div>
                <span className="text-text-primary font-bold text-base sm:text-lg">
                  {squad?.name ?? 'Squad'}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="w-full sm:w-auto">
              <Tabs<TabKey> active={tab} onChange={setTab} items={TAB_ITEMS} />
            </div>
          </div>
        </div>
      </header>

      {/* Error Toast */}
      {err && <ErrorToast msg={err} />}

      {/* Loading State */}
      {loading && <Shimmer />}

      {/* Content */}
      {!loading && (
        <main className="squad-content">
          {tab === 'metrics' && squadId && <SquadMetricsTab squadId={squadId} />}
          {tab === 'rankings' && squadId && <SquadRankings squadId={squadId} />}
          {tab === 'swimmers' && squadId && (
            <SwimmersGrid 
              swimmers={swimmers} 
              squadId={squadId}
              onAddSwimmer={handleAddSwimmer}
              onEditSwimmer={handleEditSwimmer}
              onDeleteSwimmer={handleDeleteSwimmer}
            />
          )}
          {tab === 'schedule' && <WeeklyScheduleView squadId={squadId!} schedules={schedules} onUpdate={() => {}} />}
          {tab === 'sessions' && squadId && (
            <SessionsList 
              sessions={sessions} 
              squadId={squadId} 
              schedules={schedules}
              onRefresh={() => window.location.reload()}
            />
          )}
          {tab === 'calendar' && <CalendarMonth events={events} />}
        </main>
      )}
    </div>
  )
}