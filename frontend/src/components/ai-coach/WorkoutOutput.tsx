// components/ai-coach/WorkoutOutput.tsx
import { Download, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { GeneratedWorkout } from '@/types/ai-coach/types'
import logo from '@/assets/logo.png'

interface WorkoutOutputProps {
  workout: GeneratedWorkout | null
  loading: boolean
  onSave: () => void
  onCopy: () => void
}

export default function WorkoutOutput({ workout, loading, onSave, onCopy }: WorkoutOutputProps) {
  if (loading) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-xl min-h-[600px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-12 bg-linear-to-t from-cyan-500 to-blue-500 rounded-full animate-pulse [animation-delay:0ms]"></div>
            <div className="w-3 h-12 bg-linear-to-t from-cyan-500 to-blue-500 rounded-full animate-pulse [animation-delay:150ms]"></div>
            <div className="w-3 h-12 bg-linear-to-t from-cyan-500 to-blue-500 rounded-full animate-pulse [animation-delay:300ms]"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-2">
              Generating Your Workout
            </h3>
            <p className="text-slate-400">Analyzing examples and crafting the perfect session...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-xl min-h-[600px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="w-20 h-20 bg-linear-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center opacity-60 shadow-lg">
            <img src={logo} alt="Aquilus" className="w-12 h-12 object-contain brightness-0 invert" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Ready to Generate</h3>
            <p className="text-slate-400 max-w-sm leading-relaxed">
              Describe your ideal workout and click Generate to create a custom training
              session using AI and real workout examples from the database.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-right duration-500">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-linear-to-r from-slate-900/90 to-slate-800/50">
        <h2 className="text-xl font-bold text-white">Your Custom Workout</h2>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-300 hover:text-cyan-400 text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10" 
            onClick={onCopy}
            aria-label="Copy workout"
          >
            <Copy size={16} />
            <span>Copy</span>
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-1 active:translate-y-0" 
            onClick={onSave}
            aria-label="Save workout"
          >
            <Download size={16} />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="bg-slate-950 border border-slate-700 rounded-xl p-6 h-[calc(100vh-450px)] overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none text-slate-100 leading-relaxed">
            <ReactMarkdown 
              components={{
                h1: ({children}) => <h1 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-slate-700">{children}</h1>,
                h2: ({children}) => <h2 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">{children}</h2>,
                h3: ({children}) => <h3 className="text-lg font-medium text-white mt-4 mb-2">{children}</h3>,
                p: ({children}) => <p className="text-slate-300 mb-3 leading-relaxed">{children}</p>,
                ul: ({children}) => <ul className="text-slate-300 mb-4 space-y-1 pl-4">{children}</ul>,
                li: ({children}) => <li className="text-slate-300">{children}</li>,
                strong: ({children}) => <strong className="text-cyan-400 font-semibold">{children}</strong>,
                em: ({children}) => <em className="text-slate-400">{children}</em>,
              }}
            >
              {workout.workout}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}