// components/ai-coach/WorkoutOutput.tsx
import { Download, Copy, ChevronDown, ExternalLink, Waves } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useState } from 'react'
import type { GeneratedWorkout } from '../../types/ai-coach/types'

interface WorkoutOutputProps {
  workout: GeneratedWorkout | null
  loading: boolean
  onSave: () => void
  onCopy: () => void
}

export default function WorkoutOutput({ workout, loading, onSave, onCopy }: WorkoutOutputProps) {
  const [showExamples, setShowExamples] = useState(false)

  if (loading) {
    return (
      <div className="bg-background-elevated border border-gray-700 rounded-2xl p-8 shadow-xl min-h-[600px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-12 bg-linear-to-t from-primary to-accent rounded-full animate-pulse [animation-delay:0ms]"></div>
            <div className="w-3 h-12 bg-linear-to-t from-primary to-accent rounded-full animate-pulse [animation-delay:150ms]"></div>
            <div className="w-3 h-12 bg-linear-to-t from-primary to-accent rounded-full animate-pulse [animation-delay:300ms]"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-2">
              Generating Your Workout
            </h3>
            <p className="text-gray-400">Analyzing examples and crafting the perfect session...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="bg-background-elevated border border-gray-700 rounded-2xl p-8 shadow-xl min-h-[600px] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div className="w-20 h-20 bg-linear-to-br from-primary to-accent rounded-full flex items-center justify-center opacity-60 shadow-lg">
            <Waves size={40} strokeWidth={2} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Ready to Generate</h3>
            <p className="text-gray-400 max-w-sm leading-relaxed">
              Describe your ideal workout and click Generate to create a custom training
              session using AI and real workout examples from the database.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background-elevated border border-gray-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-right duration-500">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-linear-to-r from-background-elevated to-background-tertiary">
        <h2 className="text-xl font-bold text-white">Your Custom Workout</h2>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-background-secondary hover:bg-background-tertiary border border-gray-600 hover:border-cyan-500 rounded-lg text-gray-300 hover:text-cyan-400 text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10" 
            onClick={onCopy}
            aria-label="Copy workout"
          >
            <Copy size={16} />
            <span>Copy</span>
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-primary to-accent hover:from-accent hover:to-purple-500 text-white rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-1 active:translate-y-0" 
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
        <div className="bg-background-primary border border-gray-600 rounded-xl p-6 h-[calc(100vh-450px)] overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none text-gray-100 leading-relaxed">
            <ReactMarkdown 
              components={{
                h1: ({children}) => <h1 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-gray-600">{children}</h1>,
                h2: ({children}) => <h2 className="text-xl font-semibold text-cyan-400 mt-6 mb-3">{children}</h2>,
                h3: ({children}) => <h3 className="text-lg font-medium text-white mt-4 mb-2">{children}</h3>,
                p: ({children}) => <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>,
                ul: ({children}) => <ul className="text-gray-300 mb-4 space-y-1 pl-4">{children}</ul>,
                li: ({children}) => <li className="text-gray-300">{children}</li>,
                strong: ({children}) => <strong className="text-cyan-400 font-semibold">{children}</strong>,
                em: ({children}) => <em className="text-gray-400">{children}</em>,
              }}
            >
              {workout.workout}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Referenced Workouts */}
      {workout.examples && workout.examples.length > 0 && (
        <div className="border-t border-gray-700">
          <button
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-background-tertiary transition-all duration-300 group"
            onClick={() => setShowExamples(!showExamples)}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white">
                Referenced Workouts ({workout.examples.length})
              </span>
              <span className="px-2 py-1 bg-linear-to-r from-primary to-accent text-white text-xs font-medium rounded-full">
                {workout.examples.length}
              </span>
            </div>
            <ChevronDown 
              size={16} 
              className={`text-gray-400 transition-all duration-300 group-hover:text-cyan-400 ${showExamples ? 'rotate-180' : ''}`}
            />
          </button>
          
          {showExamples && (
            <div className="px-6 pb-6 space-y-3 animate-in fade-in slide-in-from-top duration-300">
              {workout.examples.map((example) => (
                <div key={example.id} className="bg-background-secondary border border-gray-600 rounded-xl p-4 hover:border-gray-500 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white text-sm">{example.title}</span>
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-full">
                      {(example.relevance * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <a
                    href={example.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm transition-colors duration-300"
                  >
                    <span>View original</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}