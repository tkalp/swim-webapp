import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAICoach } from '@/hooks/useAICoach'
import TemplateSelector from '@/components/ai-coach/TemplateSelector'
import WorkoutOutput from '@/components/ai-coach/WorkoutOutput'
import PromptTips from '@/components/ai-coach/PromptTips'
import BestTimesInput from '@/components/ai-coach/BestTimesInput'
import type { BestTimes } from '@/types/ai-coach/types'

export default function AICoachPage() {
  const [prompt, setPrompt] = useState('')
  const [bestTimes, setBestTimes] = useState<BestTimes>({})

  const {
    loading,
    error,
    currentWorkout,
    generate,
    clearError,
  } = useAICoach()

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    clearError()
    await generate(prompt, bestTimes)
  }

  const handleSave = () => {
    if (!currentWorkout) return

    const text = `AI SWIM COACH - GENERATED WORKOUT
Generated: ${new Date(currentWorkout.timestamp).toLocaleString()}

REQUEST:
${currentWorkout.prompt}

${'='.repeat(80)}

${currentWorkout.workout}`

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workout_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = () => {
    if (!currentWorkout) return
    navigator.clipboard.writeText(currentWorkout.workout)
  }

  return (
    <div className="min-h-screen bg-[#191c29] text-white">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-6 right-6 max-w-md bg-background-elevated border border-red-500 rounded-xl p-4 shadow-2xl z-50 animate-in slide-in-from-right duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="font-semibold text-red-400 text-sm mb-1">Error</div>
              <p className="text-gray-300 text-sm leading-relaxed">{error}</p>
            </div>
            <button 
              className="text-gray-400 hover:text-white transition-colors duration-200"
              onClick={clearError}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Column - Input */}
          <div className="w-full lg:w-1/2 space-y-6">
            {/* Main Input Card */}
            <div className="bg-background-elevated border border-gray-700 rounded-2xl p-8 shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-cyan-500/5 transition-all duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-3">Describe Your Workout</h2>
                <p className="text-gray-400 text-base leading-relaxed">
                  Be specific about level, distance, focus, and any special requirements
                </p>
              </div>

              <div className="space-y-6">
                <TemplateSelector onSelect={setPrompt} />

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Custom Prompt
                  </label>
                  <div className="relative">
                    <textarea
                      className="w-full h-32 px-4 py-3 bg-[#0f172a] border border-gray-600 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your ideal workout... (e.g., 'Create a 3000 yard sprint workout for competitive swimmers with focus on underwater kicks and starts')"
                    />
                  </div>
                </div>

                <button
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-linear-to-r from-primary to-accent-purple hover:from-accent hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-1 active:translate-y-0 disabled:transform-none"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Generating Workout...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      <span>Generate Workout</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Best Times Input */}
            <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-100">
              <BestTimesInput bestTimes={bestTimes} onChange={setBestTimes} />
            </div>
            
            {/* Tips */}
            <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-200">
              <PromptTips />
            </div>
          </div>

          {/* Right Column - Output */}
          <div className="w-full lg:w-1/2 animate-in fade-in slide-in-from-right duration-500 delay-300">
            <WorkoutOutput
              workout={currentWorkout}
              loading={loading}
              onSave={handleSave}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </div>
    </div>
  )
}