import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { 
  compareSwimmers, 
  type SwimmerComparisonResult,
  type HeadToHeadEvent 
} from '@/services/squadService'
import { useSquadSwimmers } from '@/hooks/useSquadQualifiers'
import { formatTime } from '@/services/workoutResultService'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Users, 
  Calendar,
  Activity,
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface SwimmerComparisonProps {
  squadId: string
}

export default function SwimmerComparison({ squadId }: SwimmerComparisonProps) {
  const [swimmerAId, setSwimmerAId] = useState<string>('')
  const [swimmerBId, setSwimmerBId] = useState<string>('')
  const [normalizeByAge, setNormalizeByAge] = useState(false)
  const [targetAge, setTargetAge] = useState<number | undefined>(undefined)
  const [comparisonResult, setComparisonResult] = useState<SwimmerComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    headToHead: true,
    trends: true
  })

  const { data: swimmers = [], isLoading: swimmersLoading } = useSquadSwimmers(squadId)

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

  const getVelocityIcon = (category: string) => {
    switch (category) {
      case 'rapid':
        return <TrendingDown className="w-5 h-5 text-green-600" />
      case 'moderate':
        return <TrendingDown className="w-5 h-5 text-blue-600" />
      case 'slow':
        return <TrendingDown className="w-5 h-5 text-yellow-600" />
      case 'plateaued':
        return <Minus className="w-5 h-5 text-gray-600" />
      case 'declining':
        return <TrendingUp className="w-5 h-5 text-red-600" />
      default:
        return <Minus className="w-5 h-5 text-gray-600" />
    }
  }

  const getVelocityLabel = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  return (
    <div className="space-y-6">
      {/* Selection Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Compare Swimmers</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Swimmer A Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Swimmer A
            </label>
            <select
              value={swimmerAId}
              onChange={(e) => setSwimmerAId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={swimmersLoading}
            >
              <option value="">Select swimmer...</option>
              {swimmers.map((swimmer) => (
                <option key={swimmer.id} value={swimmer.id}>
                  {swimmer.first_name} {swimmer.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Swimmer B Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Swimmer B
            </label>
            <select
              value={swimmerBId}
              onChange={(e) => setSwimmerBId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={swimmersLoading}
            >
              <option value="">Select swimmer...</option>
              {swimmers.map((swimmer) => (
                <option key={swimmer.id} value={swimmer.id}>
                  {swimmer.first_name} {swimmer.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Age Normalization Options */}
        <div className="space-y-3 mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={normalizeByAge}
              onChange={(e) => setNormalizeByAge(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Compare only results from matching ages
            </span>
          </label>

          {normalizeByAge && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Age (optional)
              </label>
              <input
                type="number"
                min="6"
                max="99"
                value={targetAge || ''}
                onChange={(e) => setTargetAge(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 14"
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty to compare all overlapping ages
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || !swimmerAId || !swimmerBId}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Comparing...' : 'Compare Swimmers'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparisonResult && (
        <div className="space-y-6">
          {/* Head-to-Head Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <button
              onClick={() => toggleSection('headToHead')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Head-to-Head Comparison
              </h3>
              {expandedSections.headToHead ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {expandedSections.headToHead && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {comparisonResult.swimmer_a.name}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {comparisonResult.swimmer_b.name}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Differential
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Faster Swimmer
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {comparisonResult.head_to_head.map((event, idx) => (
                      <tr key={event.event_key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {event.event}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {event.swimmer_a ? (
                            <div>
                              <div className="font-medium text-blue-900">{event.swimmer_a.time}</div>
                              <div className="text-xs text-gray-500">
                                Age {event.swimmer_a.age?.toFixed(1)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {event.swimmer_b ? (
                            <div>
                              <div className="font-medium text-purple-900">{event.swimmer_b.time}</div>
                              <div className="text-xs text-gray-500">
                                Age {event.swimmer_b.age?.toFixed(1)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {event.differential !== null ? (
                            <div>
                              <div className="font-medium">
                                {Math.abs(event.differential).toFixed(2)}s
                              </div>
                              <div className="text-xs text-gray-500">
                                {event.percentage_faster?.toFixed(1)}% faster
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {event.faster_swimmer === 'swimmer_a' ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {comparisonResult.swimmer_a.name}
                            </span>
                          ) : event.faster_swimmer === 'swimmer_b' ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              {comparisonResult.swimmer_b.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trend Analysis */}
          {comparisonResult.trend_analysis.overall && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <button
                onClick={() => toggleSection('trends')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-green-600" />
                  Historical Trend Analysis
                </h3>
                {expandedSections.trends ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {expandedSections.trends && (
                <div className="px-6 pb-6 space-y-4">
                  <p className="text-sm text-gray-600">
                    Analysis of improvement velocity and consistency over time
                  </p>

                  {/* Overall Trend Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Swimmer A Trend */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                      <h4 className="font-semibold text-blue-900">{comparisonResult.swimmer_a.name}</h4>
                      <div className="flex items-center gap-2">
                        {getVelocityIcon(comparisonResult.trend_analysis.overall.swimmer_a.velocity_category)}
                        <span className="text-sm font-medium">
                          {getVelocityLabel(comparisonResult.trend_analysis.overall.swimmer_a.velocity_category)} Improvement
                        </span>
                      </div>
                      <div className="text-sm text-blue-700">
                        <p>
                          <strong>Rate:</strong>{' '}
                          {comparisonResult.trend_analysis.overall.swimmer_a.improvement_per_year.toFixed(2)}s/year
                        </p>
                        <p>
                          <strong>Consistency:</strong>{' '}
                          {comparisonResult.trend_analysis.overall.swimmer_a.consistency_score.toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    {/* Swimmer B Trend */}
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                      <h4 className="font-semibold text-purple-900">{comparisonResult.swimmer_b.name}</h4>
                      <div className="flex items-center gap-2">
                        {getVelocityIcon(comparisonResult.trend_analysis.overall.swimmer_b.velocity_category)}
                        <span className="text-sm font-medium">
                          {getVelocityLabel(comparisonResult.trend_analysis.overall.swimmer_b.velocity_category)} Improvement
                        </span>
                      </div>
                      <div className="text-sm text-purple-700">
                        <p>
                          <strong>Rate:</strong>{' '}
                          {comparisonResult.trend_analysis.overall.swimmer_b.improvement_per_year.toFixed(2)}s/year
                        </p>
                        <p>
                          <strong>Consistency:</strong>{' '}
                          {comparisonResult.trend_analysis.overall.swimmer_b.consistency_score.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Velocity Advantage */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-semibold text-green-900">
                      Improvement Advantage:{' '}
                      {comparisonResult.trend_analysis.overall.comparison.velocity_advantage === 'swimmer_a'
                        ? comparisonResult.swimmer_a.name
                        : comparisonResult.trend_analysis.overall.comparison.velocity_advantage === 'swimmer_b'
                        ? comparisonResult.swimmer_b.name
                        : 'Similar rates'}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Relative velocity: {Math.abs(comparisonResult.trend_analysis.overall.comparison.relative_velocity).toFixed(2)}s/year difference
                    </p>
                  </div>

                  {/* Event-Level Trends */}
                  {comparisonResult.trend_analysis.events_analyzed > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Event-Specific Trends ({comparisonResult.trend_analysis.events_analyzed} events)
                      </h4>
                      <div className="text-sm text-gray-600">
                        Detailed trend analysis available for events with multiple results over time
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
