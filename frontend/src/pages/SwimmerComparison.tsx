import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { 
  compareSwimmers, 
  type SwimmerComparisonResult,
  type HeadToHeadEvent 
} from '@/services/squadService'
import { apiClient } from '@/lib/apiClient'
import { useQuery } from '@tanstack/react-query'
import { formatTime } from '@/services/workoutResultService'
import SwimmerSelect from '@/components/SwimmerSelect'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Users, 
  Calendar,
  Activity,
  Target,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'

type Swimmer = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  sex: string
  squad_id: string
}

type Squad = {
  id: string
  name: string
}

export default function SwimmerComparisonPage() {
  const { user } = useAuth()
  const [selectedSquadId, setSelectedSquadId] = useState<string>('')
  const [swimmerAId, setSwimmerAId] = useState<string>('')
  const [swimmerBId, setSwimmerBId] = useState<string>('')
  const [normalizeByAge, setNormalizeByAge] = useState(false)
  const [targetAge, setTargetAge] = useState<number | undefined>(undefined)
  const [comparisonResult, setComparisonResult] = useState<SwimmerComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCommonEventsOnly, setShowCommonEventsOnly] = useState(true)
  const [expandedSections, setExpandedSections] = useState({
    headToHead: true,
    trends: true,
    charts: true,
    predictions: true
  })
  
  // Filter states
  const [selectedStroke, setSelectedStroke] = useState<string>('all')
  const [selectedDistance, setSelectedDistance] = useState<string>('all')
  const [selectedPoolType, setSelectedPoolType] = useState<string>('all')
  const [selectedActivity, setSelectedActivity] = useState<string>('all')

  // Fetch coach's squads
  const { data: squads = [], isLoading: squadsLoading } = useQuery({
    queryKey: ['coach-squads', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const data = await apiClient.get<any[]>('/squads')
      return (data || []).map((s: any) => ({ id: s.id, name: s.name })) as Squad[]
    },
    enabled: !!user?.id
  })

  // Fetch all swimmers from coach's squads
  const { data: allSwimmers = [], isLoading: swimmersLoading } = useQuery({
    queryKey: ['all-swimmers', user?.id],
    queryFn: async () => {
      if (!user?.id || squads.length === 0) return []
      const results = await Promise.all(
        squads.map((s: Squad) => apiClient.get<Swimmer[]>(`/squads/${s.id}/swimmers`))
      )
      return results.flat()
    },
    enabled: !!user?.id && squads.length > 0
  })

  // Filter swimmers by selected squad
  const filteredSwimmers = selectedSquadId 
    ? allSwimmers.filter(s => s.squad_id === selectedSquadId)
    : allSwimmers

  // Filter head-to-head events to show only common events and apply filters
  const filteredHeadToHead = useMemo(() => {
    if (!comparisonResult) return []
    
    let filtered = comparisonResult.head_to_head
    
    // Common events filter
    if (showCommonEventsOnly) {
      filtered = filtered.filter(
        event => event.swimmer_a !== null && event.swimmer_b !== null
      )
    }
    
    // Stroke filter
    if (selectedStroke !== 'all') {
      filtered = filtered.filter(event => {
        const eventParts = event.event.split(' ')
        const stroke = eventParts[eventParts.length - 1].toLowerCase()
        return stroke === selectedStroke
      })
    }
    
    // Distance filter
    if (selectedDistance !== 'all') {
      filtered = filtered.filter(event => {
        const eventParts = event.event.split(' ')
        const distance = eventParts[0]
        return distance === selectedDistance
      })
    }
    
    // Pool type filter
    if (selectedPoolType !== 'all') {
      filtered = filtered.filter(event => {
        const poolType = event.event.includes('SCM') ? 'scm' : event.event.includes('LCM') ? 'lcm' : 'scy'
        return poolType === selectedPoolType
      })
    }
    
    // Activity filter
    if (selectedActivity !== 'all') {
      filtered = filtered.filter(event => {
        const hasRelay = event.event.toLowerCase().includes('relay')
        if (selectedActivity === 'race') return !hasRelay
        if (selectedActivity === 'relay') return hasRelay
        return true
      })
    }
    
    return filtered
  }, [comparisonResult, showCommonEventsOnly, selectedStroke, selectedDistance, selectedPoolType, selectedActivity])

  const handleCompare = async () => {
    if (!swimmerAId || !swimmerBId) {
      setError('Please select both swimmers')
      return
    }

    if (swimmerAId === swimmerBId) {
      setError('Please select two different swimmers')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Find the squad ID for the comparison endpoint
      const swimmerA = allSwimmers.find(s => s.id === swimmerAId)
      const squadId = swimmerA?.squad_id || selectedSquadId

      if (!squadId) {
        throw new Error('Could not determine squad ID')
      }

      const result = await compareSwimmers(squadId, swimmerAId, swimmerBId, {
        normalizeByAge,
        targetAge: targetAge || undefined
      })
      setComparisonResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare swimmers')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const getSwimmerLabel = (swimmer: Swimmer) => {
    const squad = squads.find(s => s.id === swimmer.squad_id)
    return `${swimmer.first_name} ${swimmer.last_name}${squad ? ` (${squad.name})` : ''}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/10">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 animate-pulse" />
          
          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                <Users className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Swimmer Comparison
              </h1>
            </div>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Compare performance between two swimmers with historical trend analysis and predictive projections
            </p>
          </div>

          {/* Decorative corner accents */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-bl-full blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full blur-2xl" />
        </div>

        {/* Selection Controls */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5" />
          
          <div className="relative p-6">
            <h2 className="text-xl font-semibold mb-6 text-slate-100">Select Swimmers</h2>
          
            {/* Squad Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Filter by Squad (optional)
              </label>
              <select
                value={selectedSquadId}
                onChange={(e) => {
                  setSelectedSquadId(e.target.value)
                  setSwimmerAId('')
                  setSwimmerBId('')
                }}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
                disabled={squadsLoading}
              >
                <option value="">All squads</option>
                {squads.map((squad) => (
                  <option key={squad.id} value={squad.id}>
                    {squad.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Swimmer A Select */}
              <SwimmerSelect
                swimmers={filteredSwimmers}
                squads={squads}
                value={swimmerAId}
                onChange={setSwimmerAId}
                label="Swimmer A"
                color="blue"
                disabled={swimmersLoading}
                placeholder="Search for swimmer A..."
              />

              {/* Swimmer B Select */}
              <SwimmerSelect
                swimmers={filteredSwimmers}
                squads={squads}
                value={swimmerBId}
                onChange={setSwimmerBId}
                label="Swimmer B"
                color="purple"
                disabled={swimmersLoading}
                placeholder="Search for swimmer B..."
              />
            </div>

            {/* Age Normalization Options */}
            <div className="space-y-4 mb-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <label className="flex items-center group cursor-pointer">
                <input
                  type="checkbox"
                  checked={normalizeByAge}
                  onChange={(e) => setNormalizeByAge(e.target.checked)}
                  className="h-4 w-4 text-cyan-500 focus:ring-cyan-500/50 border-slate-600 rounded bg-slate-800"
                />
                <span className="ml-3 text-sm text-slate-300 group-hover:text-cyan-400 transition-colors">
                  Compare only results from matching ages
                </span>
              </label>

              {normalizeByAge && (
                <div className="pl-7 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-medium text-slate-400">
                    Target Age (optional)
                  </label>
                  <input
                    type="number"
                    min="6"
                    max="99"
                    value={targetAge || ''}
                    onChange={(e) => setTargetAge(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 14"
                    className="w-32 px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">
                    Leave empty to compare all overlapping ages
                  </p>
                </div>
              )}

              <label className="flex items-center group cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCommonEventsOnly}
                  onChange={(e) => setShowCommonEventsOnly(e.target.checked)}
                  className="h-4 w-4 text-cyan-500 focus:ring-cyan-500/50 border-slate-600 rounded bg-slate-800"
                />
                <span className="ml-3 text-sm text-slate-300 group-hover:text-cyan-400 transition-colors flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Show only events both swimmers competed in
                </span>
              </label>
            </div>

            <button
              onClick={handleCompare}
              disabled={loading || !swimmerAId || !swimmerBId}
              className="relative w-full group overflow-hidden rounded-xl transition-all duration-200"
            >
              <div className={`
                absolute inset-0 transition-all duration-200
                ${loading || !swimmerAId || !swimmerBId 
                  ? 'bg-slate-700/50' 
                  : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 group-hover:shadow-2xl group-hover:shadow-cyan-500/20'
                }
              `} />
              <div className="relative px-6 py-3 font-semibold text-white flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5" />
                    Compare Swimmers
                  </>
                )}
              </div>
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Comparison Results */}
        {comparisonResult && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filters Section */}
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
              <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 via-transparent to-blue-500/5" />
              
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                      <Filter className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Filter Events</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{filteredHeadToHead.length} events</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Stroke Filter */}
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                      Stroke
                    </label>
                    <select
                      value={selectedStroke}
                      onChange={(e) => setSelectedStroke(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/70 border border-slate-600/50 rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all hover:bg-slate-800/90 hover:border-cyan-500/30"
                    >
                      <option value="all">All Strokes</option>
                      <option value="free">Freestyle</option>
                      <option value="back">Backstroke</option>
                      <option value="breast">Breaststroke</option>
                      <option value="fly">Butterfly</option>
                      <option value="im">IM</option>
                    </select>
                  </div>
                  
                  {/* Distance Filter */}
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                      Distance
                    </label>
                    <select
                      value={selectedDistance}
                      onChange={(e) => setSelectedDistance(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/70 border border-slate-600/50 rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all hover:bg-slate-800/90 hover:border-cyan-500/30"
                    >
                      <option value="all">All Distances</option>
                      <option value="50">50m</option>
                      <option value="100">100m</option>
                      <option value="200">200m</option>
                      <option value="400">400m</option>
                      <option value="800">800m</option>
                      <option value="1500">1500m</option>
                    </select>
                  </div>
                  
                  {/* Pool Type Filter */}
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                      Pool Type
                    </label>
                    <select
                      value={selectedPoolType}
                      onChange={(e) => setSelectedPoolType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/70 border border-slate-600/50 rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all hover:bg-slate-800/90 hover:border-cyan-500/30"
                    >
                      <option value="all">All Pool Types</option>
                      <option value="scm">SCM (25m)</option>
                      <option value="lcm">LCM (50m)</option>
                      <option value="scy">SCY (25yd)</option>
                    </select>
                  </div>
                  
                  {/* Activity Filter */}
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                      Activity Type
                    </label>
                    <select
                      value={selectedActivity}
                      onChange={(e) => setSelectedActivity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/70 border border-slate-600/50 rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all hover:bg-slate-800/90 hover:border-cyan-500/30"
                    >
                      <option value="all">All Activities</option>
                      <option value="race">Individual Races</option>
                      <option value="relay">Relays</option>
                    </select>
                  </div>
                </div>
                
                {/* Active Filters Count */}
                {(selectedStroke !== 'all' || selectedDistance !== 'all' || selectedPoolType !== 'all' || selectedActivity !== 'all') && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm text-cyan-400">
                      {filteredHeadToHead.length} event{filteredHeadToHead.length !== 1 ? 's' : ''} match{filteredHeadToHead.length === 1 ? 'es' : ''} filters
                    </span>
                    <button
                      onClick={() => {
                        setSelectedStroke('all')
                        setSelectedDistance('all')
                        setSelectedPoolType('all')
                        setSelectedActivity('all')
                      }}
                      className="text-sm text-slate-400 hover:text-cyan-400 underline transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Head-to-Head Table */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
              
              <button
                onClick={() => toggleSection('headToHead')}
                className="relative w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors group"
              >
                <h3 className="text-lg font-semibold flex items-center gap-3 text-slate-100">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 shadow-lg shadow-blue-500/10">
                    <Activity className="w-5 h-5 text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                  </div>
                  Head-to-Head Comparison
                </h3>
                {expandedSections.headToHead ? 
                  <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" /> : 
                  <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                }
              </button>

              {expandedSections.headToHead && (
                <div className="relative overflow-x-auto">
                  {filteredHeadToHead.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No common events found between these swimmers.</p>
                      <p className="text-sm mt-2">Try disabling the "common events only" filter.</p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-slate-700/50">
                      <thead className="bg-slate-800/50 backdrop-blur-sm">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Event
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-blue-400 uppercase tracking-wider">
                            {comparisonResult.swimmer_a.name}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-purple-400 uppercase tracking-wider">
                            {comparisonResult.swimmer_b.name}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Differential
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Faster Swimmer
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {filteredHeadToHead.map((event, idx) => (
                          <tr key={event.event_key} className={idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                              {event.event}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {event.swimmer_a ? (
                                <div>
                                  <div className="font-medium text-blue-300">{event.swimmer_a.time}</div>
                                  <div className="text-xs text-slate-500">
                                    Age {event.swimmer_a.age?.toFixed(1)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {event.swimmer_b ? (
                                <div>
                                  <div className="font-medium text-purple-300">{event.swimmer_b.time}</div>
                                  <div className="text-xs text-slate-500">
                                    Age {event.swimmer_b.age?.toFixed(1)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {event.differential !== null ? (
                                <div>
                                  <div className="font-medium text-slate-300">
                                    {Math.abs(event.differential).toFixed(2)}s
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {event.percentage_faster?.toFixed(1)}% faster
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {event.faster_swimmer === 'swimmer_a' ? (
                                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-medium shadow-sm shadow-blue-500/10">
                                  {comparisonResult.swimmer_a.name}
                                </span>
                              ) : event.faster_swimmer === 'swimmer_b' ? (
                                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-medium shadow-sm shadow-purple-500/10">
                                  {comparisonResult.swimmer_b.name}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Predictions Section */}
            {comparisonResult.predictions && comparisonResult.predictions.events.length > 0 && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5" />

                <button
                  onClick={() => toggleSection('predictions')}
                  className="relative w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors group"
                >
                  <h3 className="text-lg font-semibold flex items-center gap-3 text-slate-100">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 shadow-lg shadow-purple-500/10">
                      <Target className="w-5 h-5 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
                    </div>
                    Race Win Probabilities
                  </h3>
                  {expandedSections.predictions ?
                    <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" /> :
                    <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  }
                </button>

                {expandedSections.predictions && (
                  <div className="relative px-6 pb-6">
                    <div className="mb-4 flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-400" />
                        <span className="text-slate-300">{comparisonResult.swimmer_a.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-400" />
                        <span className="text-slate-300">{comparisonResult.swimmer_b.name}</span>
                      </div>
                      <div className="ml-auto text-xs text-slate-500">
                        Overall favourite:{' '}
                        <span className={
                          comparisonResult.predictions.overall_favorite === 'swimmer_a'
                            ? 'text-blue-400 font-medium'
                            : comparisonResult.predictions.overall_favorite === 'swimmer_b'
                            ? 'text-purple-400 font-medium'
                            : 'text-slate-400 font-medium'
                        }>
                          {comparisonResult.predictions.overall_favorite === 'swimmer_a'
                            ? comparisonResult.swimmer_a.name
                            : comparisonResult.predictions.overall_favorite === 'swimmer_b'
                            ? comparisonResult.swimmer_b.name
                            : 'Even'}
                        </span>
                        {' '}({(comparisonResult.predictions.average_confidence * 100).toFixed(0)}% avg confidence)
                      </div>
                    </div>

                    <div className="space-y-3">
                      {comparisonResult.predictions.events.map((pred) => (
                        <div key={pred.event} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-200">{pred.event}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              pred.confidence_level === 'high'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : pred.confidence_level === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                            }`}>
                              {pred.confidence_level} confidence
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-400 w-10 text-right">
                              {(pred.swimmer_a_probability * 100).toFixed(0)}%
                            </span>
                            <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden flex">
                              <div
                                className="h-full bg-blue-400 transition-all duration-500"
                                style={{ width: `${pred.swimmer_a_probability * 100}%` }}
                              />
                              <div
                                className="h-full bg-purple-400 transition-all duration-500"
                                style={{ width: `${pred.swimmer_b_probability * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-purple-400 w-10">
                              {(pred.swimmer_b_probability * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
