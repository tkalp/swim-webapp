import { Sparkles, Info, TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatTime } from '../../utils/timeUtils'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface PredictionFactors {
  attempts_analyzed?: number
  consistency?: number
  improvement_rate?: number
  recent_form?: number
  training_alignment?: number
  recent_training_volume_meters?: number
  avg_workout_effort?: number
  attendance_rate?: number
}

interface GapAnalysis {
  status: 'on_track' | 'needs_attention' | 'intervention_required' | 'insufficient_data'
  status_label: string
  severity: 'none' | 'warning' | 'critical'
  likely_causes: Array<{
    factor: string
    swimmer_value: number | null
    squad_average: number | null
    impact: 'high' | 'medium' | 'low'
    description: string
  }>
  recommended_actions: Array<{
    priority: 'high' | 'medium'
    action: string
    category: string
  }>
  achievement_rate?: number
  predictions_tested?: number
}

interface PredictionBadgeProps {
  prediction: {
    predicted_time: number
    current_best: number
    current_best_is_converted?: boolean
    current_best_converted_from?: string
    confidence_level: 'high' | 'medium' | 'low'
    achievement_rate?: number
    achievement_confidence?: string
    avg_attempts_to_achieve?: number
    predictions_tested?: number
    factors?: PredictionFactors
    gap_analysis?: GapAnalysis
  }
  showTooltipBelow?: boolean
  compact?: boolean
}

export function PredictionBadge({ 
  prediction, 
  showTooltipBelow = false,
  compact = false
}: PredictionBadgeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const badgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHovered && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: showTooltipBelow ? rect.bottom + 8 : rect.top - 8,
        left: rect.left + rect.width / 2
      })
    }
  }, [isHovered, showTooltipBelow])

  const tooltip = isHovered && createPortal(
    <div 
      className={`fixed w-72 p-4 bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-500/20 z-[9999] pointer-events-none transition-opacity duration-200`}
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        transform: showTooltipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
      }}
    >
      <div className={`absolute ${showTooltipBelow ? 'bottom-full' : 'top-full'} left-1/2 -translate-x-1/2`}>
        <div className={`border-8 border-transparent ${showTooltipBelow ? 'border-b-purple-500/30' : 'border-t-purple-500/30'}`}></div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
          <Sparkles size={16} className="text-purple-400" />
          <h4 className="font-semibold text-purple-300">AI Prediction</h4>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
            prediction.confidence_level === 'high' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : prediction.confidence_level === 'medium'
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
          }`}>
            {prediction.confidence_level}
          </span>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Current Best:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-slate-200">{formatTime(prediction.current_best)}</span>
              {prediction.current_best_is_converted && prediction.current_best_converted_from && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
                  from {prediction.current_best_converted_from}
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Predicted:</span>
            <span className="font-mono font-bold text-purple-400">{formatTime(prediction.predicted_time)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-700/50">
            <span className="text-slate-400">Expected Change:</span>
            <div className="flex items-center gap-1">
              {prediction.current_best > prediction.predicted_time ? (
                <TrendingDown size={14} className="text-green-400" />
              ) : (
                <TrendingUp size={14} className="text-red-400" />
              )}
              <span className={`font-mono font-bold ${prediction.current_best > prediction.predicted_time ? 'text-green-400' : 'text-red-400'}`}>
                {prediction.current_best > prediction.predicted_time ? '-' : '+'}{Math.abs(prediction.current_best - prediction.predicted_time).toFixed(2)}s
              </span>
            </div>
          </div>
          
          {prediction.achievement_rate !== null && prediction.achievement_rate !== undefined && prediction.predictions_tested && prediction.predictions_tested > 0 && (
            <div className="pt-2 mt-2 border-t border-purple-500/20">
              <div className="text-xs text-purple-300 font-medium mb-1">Model Accuracy:</div>
              <div className={`text-sm font-semibold ${
                prediction.achievement_rate >= 80 ? 'text-green-400' :
                prediction.achievement_rate >= 60 ? 'text-yellow-400' :
                'text-orange-400'
              }`}>
                {prediction.achievement_rate.toFixed(0)}% of similar predictions achieved
              </div>
              {prediction.avg_attempts_to_achieve && (
                <div className="text-xs text-slate-400 mt-0.5">
                  Typically within {Math.round(prediction.avg_attempts_to_achieve)} attempts
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-1">
                Based on {prediction.predictions_tested} historical prediction{prediction.predictions_tested !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          
          {prediction.gap_analysis && prediction.gap_analysis.status !== 'insufficient_data' && (
            <div className="pt-2 mt-2 border-t border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                {prediction.gap_analysis.status === 'on_track' ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : (
                  <AlertTriangle size={14} className={
                    prediction.gap_analysis.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
                  } />
                )}
                <span className={`text-xs font-semibold ${
                  prediction.gap_analysis.status === 'on_track' ? 'text-green-400' :
                  prediction.gap_analysis.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {prediction.gap_analysis.status_label}
                </span>
              </div>
              
              {prediction.gap_analysis.likely_causes && prediction.gap_analysis.likely_causes.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  <div className="text-[10px] text-slate-400 font-medium">Contributing Factors:</div>
                  {prediction.gap_analysis.likely_causes.map((cause, idx) => (
                    <div key={idx} className="text-xs bg-slate-800/50 rounded px-2 py-1">
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          cause.impact === 'high' ? 'bg-red-400' :
                          cause.impact === 'medium' ? 'bg-yellow-400' :
                          'bg-blue-400'
                        }`} />
                        <span className="text-slate-300 font-medium capitalize">
                          {cause.factor.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 ml-2.5">
                        {cause.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {prediction.gap_analysis.recommended_actions && prediction.gap_analysis.recommended_actions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-medium">Recommendations:</div>
                  {prediction.gap_analysis.recommended_actions.slice(0, 3).map((action, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                      <span className={`inline-block w-1 h-1 rounded-full mt-1.5 shrink-0 ${
                        action.priority === 'high' ? 'bg-orange-400' : 'bg-blue-400'
                      }`} />
                      <span>{action.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {prediction.factors && (
          <div className="pt-2 border-t border-purple-500/20">
            <div className="text-xs text-slate-500 mb-1.5">Based on:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {prediction.factors.attempts_analyzed && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Attempts:</span>
                  <span className="text-slate-300 font-medium">{prediction.factors.attempts_analyzed}</span>
                </div>
              )}
              {prediction.factors.consistency !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Consistency:</span>
                  <span className="text-slate-300 font-medium">{(prediction.factors.consistency * 100).toFixed(0)}%</span>
                </div>
              )}
              {prediction.factors.improvement_rate !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Trend:</span>
                  <span className={`font-medium ${prediction.factors.improvement_rate < 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {prediction.factors.improvement_rate < 0 ? '↓' : '↑'} {Math.abs(prediction.factors.improvement_rate).toFixed(3)}s
                  </span>
                </div>
              )}
              {prediction.factors.recent_form !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Recent Form:</span>
                  <span className="text-slate-300 font-medium">{(prediction.factors.recent_form * 100).toFixed(0)}%</span>
                </div>
              )}
              {prediction.factors.training_alignment !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Training Fit:</span>
                  <span className="text-slate-300 font-medium">{(prediction.factors.training_alignment * 100).toFixed(0)}%</span>
                </div>
              )}
              {prediction.factors.recent_training_volume_meters !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume (30d):</span>
                  <span className="text-slate-300 font-medium">{(prediction.factors.recent_training_volume_meters / 1000).toFixed(1)}km</span>
                </div>
              )}
              {prediction.factors.avg_workout_effort !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Effort:</span>
                  <span className="text-slate-300 font-medium">{prediction.factors.avg_workout_effort}/10</span>
                </div>
              )}
              {prediction.factors.attendance_rate !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Attendance:</span>
                  <span className="text-slate-300 font-medium">{prediction.factors.attendance_rate.toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <div 
        ref={badgeRef}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-linear-to-br from-purple-500/15 via-purple-500/8 to-transparent border rounded-md hover:shadow-md transition-all cursor-help ${
          prediction.gap_analysis?.severity === 'critical' 
            ? 'border-red-500/40 hover:border-red-400/60 hover:shadow-red-500/10' 
            : prediction.gap_analysis?.severity === 'warning'
            ? 'border-yellow-500/40 hover:border-yellow-400/60 hover:shadow-yellow-500/10'
            : 'border-purple-500/30 hover:border-purple-400/50 hover:shadow-purple-500/10'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {prediction.gap_analysis?.severity === 'critical' && (
          <AlertTriangle size={11} className="text-red-400 transition-colors shrink-0" />
        )}
        {prediction.gap_analysis?.severity === 'warning' && (
          <AlertTriangle size={11} className="text-yellow-400 transition-colors shrink-0" />
        )}
        {(!prediction.gap_analysis || prediction.gap_analysis.severity === 'none') && (
          <Sparkles size={11} className="text-purple-400 transition-colors shrink-0" />
        )}
        <span className="text-xs font-bold text-purple-300 font-mono tracking-tight transition-colors">
          {formatTime(prediction.predicted_time)}
        </span>
        <Info size={9} className="text-purple-400/60 transition-colors shrink-0" />
      </div>
      {tooltip}
    </>
  )
}
