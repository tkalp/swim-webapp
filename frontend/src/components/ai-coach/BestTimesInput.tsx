import { useState } from 'react'
import { Timer, Plus, X, Info, ChevronDown, Zap } from 'lucide-react'
import type { BestTimes } from '@/types/ai-coach/types'

interface BestTimesInputProps {
  bestTimes: BestTimes
  onChange: (times: BestTimes) => void
}

const COMMON_DISTANCES = [
  { value: '25', label: '25m' },
  { value: '50', label: '50m' },
  { value: '100', label: '100m' },
  { value: '200', label: '200m' },
  { value: '400', label: '400m' },
  { value: '800', label: '800m' },
  { value: '1500', label: '1500m' },
]

export default function BestTimesInput({ bestTimes, onChange }: BestTimesInputProps) {
  const [expanded, setExpanded] = useState(false)
  const [customDistance, setCustomDistance] = useState('')

  const handleTimeChange = (distance: string, time: string) => {
    if (time === '') {
      const newTimes = { ...bestTimes }
      delete newTimes[distance]
      onChange(newTimes)
    } else {
      onChange({ ...bestTimes, [distance]: time })
    }
  }

  const addCustomDistance = () => {
    if (customDistance && !bestTimes[customDistance]) {
      onChange({ ...bestTimes, [customDistance]: '' })
      setCustomDistance('')
    }
  }

  const removeDistance = (distance: string) => {
    const newTimes = { ...bestTimes }
    delete newTimes[distance]
    onChange(newTimes)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addCustomDistance()
    }
  }

  const hasAnyTimes = Object.keys(bestTimes).length > 0

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-lg hover:shadow-cyan-500/5">
      {/* Header */}
      <button
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-800/50 transition-all duration-300 group"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-linear-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
            <Timer size={20} className="text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-white flex items-center gap-3">
              Best Times 
              <span className="text-slate-400 font-normal text-sm">(Optional)</span>
              {hasAnyTimes && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-linear-to-r from-cyan-500 to-blue-500 text-white text-xs font-semibold shadow-lg animate-pulse">
                  <Zap size={12} />
                  {Object.keys(bestTimes).length}
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              {hasAnyTimes 
                ? 'AI will personalize intervals based on your performance'
                : 'Add your best times for personalized pace recommendations'
              }
            </p>
          </div>
        </div>
        <ChevronDown 
          size={20} 
          className={`text-slate-400 transition-all duration-300 group-hover:text-cyan-400 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-slate-700 animate-in fade-in slide-in-from-top duration-300">
          {/* Info Banner */}
          <div className="mt-6 mb-8 p-5 bg-linear-to-br from-slate-800/50 to-slate-900/50 rounded-2xl border border-cyan-500/30 shadow-lg">
            <div className="flex gap-4">
              <div className="p-2 bg-cyan-500/20 rounded-xl h-fit">
                <Info size={20} className="text-cyan-400" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-white mb-2">How this works</p>
                <p className="text-slate-300 leading-relaxed">
                  Enter your best times to get personalized training intervals. The AI will calculate 
                  appropriate paces for different training zones (easy, threshold, VO2 max, etc.) based 
                  on your actual performance.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Add Buttons */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-300 mb-4">
              Quick Add Common Distances
            </label>
            <div className="flex flex-wrap gap-3">
              {COMMON_DISTANCES.map(({ value, label }) => {
                const isAdded = value in bestTimes
                return (
                  <button
                    key={value}
                    onClick={() => {
                      if (!isAdded) {
                        onChange({ ...bestTimes, [value]: '' })
                      }
                    }}
                    disabled={isAdded}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      isAdded
                        ? 'bg-linear-to-r from-green-500 to-green-400 text-white shadow-lg cursor-default'
                        : 'bg-slate-800/50 text-white border border-slate-700 hover:bg-linear-to-r hover:from-cyan-500 hover:to-blue-500 hover:border-transparent hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-1 active:translate-y-0'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Inputs */}
          {Object.keys(bestTimes).length > 0 && (
            <div className="space-y-4 mb-8">
              <label className="block text-sm font-semibold text-slate-300 mb-4">
                Your Best Times
              </label>
              {Object.entries(bestTimes).map(([distance, time]) => (
                <div key={distance} className="flex items-center gap-4 group/row">
                  <div className="w-28 px-4 py-3 bg-linear-to-br from-slate-800/50 to-slate-900/50 rounded-xl text-sm font-bold text-white text-center border border-slate-700 shadow-lg">
                    {distance}m
                  </div>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => handleTimeChange(distance, e.target.value)}
                    placeholder="1:23.45 or 52.3"
                    className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-300 hover:border-slate-600"
                  />
                  <button
                    onClick={() => removeDistance(distance)}
                    className="p-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 opacity-0 group-hover/row:opacity-100 hover:scale-110"
                    aria-label="Remove time"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Custom Distance Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-4">
              Add Custom Distance
            </label>
            <div className="flex gap-4">
              <input
                type="number"
                value={customDistance}
                onChange={(e) => setCustomDistance(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., 300"
                className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-300 hover:border-slate-600"
              />
              <button
                onClick={addCustomDistance}
                disabled={!customDistance || customDistance in bestTimes}
                className="px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-1 disabled:from-slate-600 disabled:to-slate-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none transition-all duration-300 flex items-center gap-2"
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          </div>

          {/* Format Help */}
          <div className="p-5 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-white">Time Format:</span> Enter times as either seconds (52.3) or 
              minutes:seconds (1:23.45). Examples: <span className="text-cyan-400 font-medium">24.5</span> for a 50m, <span className="text-cyan-400 font-medium">1:54.2</span> for a 200m, <span className="text-cyan-400 font-medium">5:10.5</span> for a 500m.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}