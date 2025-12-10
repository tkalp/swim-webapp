import { TrendingDown, TrendingUp, Info } from 'lucide-react'
import { useState } from 'react'

interface PredictionBadgeProps {
  currentTime: number // in seconds
  predictedTime: number | null // in seconds
  confidence: 'high' | 'medium' | 'low'
  factors?: {
    improvement_rate?: number
    consistency?: number
    recent_form?: number
    attempts_analyzed?: number
  }
  className?: string
}

export default function PredictionBadge({
  currentTime,
  predictedTime,
  confidence,
  factors,
  className = ''
}: PredictionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!predictedTime) return null

  const timeDiff = currentTime - predictedTime
  const isImprovement = timeDiff > 0
  const percentChange = Math.abs((timeDiff / currentTime) * 100)

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(2)
    return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${parseFloat(secs).toFixed(2)}s`
  }

  const getConfidenceColor = () => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getConfidenceDot = () => {
    switch (confidence) {
      case 'high':
        return 'bg-green-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-gray-400'
    }
  }

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getConfidenceColor()} text-sm font-medium`}>
        {isImprovement ? (
          <TrendingDown className="w-4 h-4 text-green-600" />
        ) : (
          <TrendingUp className="w-4 h-4 text-red-600" />
        )}
        <span>Next: {formatTime(predictedTime)}</span>
        <span className="text-xs opacity-75">
          ({isImprovement ? '-' : '+'}{percentChange.toFixed(1)}%)
        </span>
      </div>

      {factors && (
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Info className="w-4 h-4 text-gray-500" />
          </button>

          {showTooltip && (
            <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${getConfidenceDot()}`} />
                <span className="font-semibold capitalize">{confidence} Confidence</span>
              </div>
              
              <div className="space-y-1.5 text-gray-600">
                {factors.attempts_analyzed !== undefined && (
                  <div className="flex justify-between">
                    <span>Based on:</span>
                    <span className="font-medium text-gray-900">{factors.attempts_analyzed} recent swims</span>
                  </div>
                )}
                {factors.improvement_rate !== undefined && (
                  <div className="flex justify-between">
                    <span>Improvement rate:</span>
                    <span className="font-medium text-gray-900">
                      {factors.improvement_rate > 0 ? '+' : ''}{factors.improvement_rate.toFixed(3)}s/attempt
                    </span>
                  </div>
                )}
                {factors.consistency !== undefined && (
                  <div className="flex justify-between">
                    <span>Consistency:</span>
                    <span className="font-medium text-gray-900">{(factors.consistency * 100).toFixed(1)}%</span>
                  </div>
                )}
                {factors.recent_form !== undefined && (
                  <div className="flex justify-between">
                    <span>Recent form:</span>
                    <span className="font-medium text-gray-900">{(factors.recent_form * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-gray-200 text-gray-500">
                Prediction assumes continued training and 3 more attempts
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
