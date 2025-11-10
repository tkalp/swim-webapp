// components/ai-coach/PromptTips.tsx
import { Lightbulb, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function PromptTips() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-background-elevated border border-gray-700 rounded-2xl overflow-hidden transition-all duration-300 hover:border-gray-600 hover:shadow-lg hover:shadow-yellow-500/5">
      <button
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-background-tertiary transition-all duration-300 group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-linear-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
            <Lightbulb size={20} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Tips for Better Results</span>
        </div>
        <ChevronDown 
          size={20} 
          className={`text-gray-400 transition-all duration-300 group-hover:text-yellow-400 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      
      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-700 animate-in fade-in slide-in-from-top duration-300">
          <div className="mt-5 space-y-6">
            <div>
              <h5 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                Include these details:
              </h5>
              <ul className="space-y-3 text-sm text-gray-300 leading-relaxed">
                <li className="flex gap-3">
                  <span className="text-yellow-400 font-semibold min-w-fit">Level:</span>
                  <span>Beginner, intermediate, advanced, competitive, masters</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-yellow-400 font-semibold min-w-fit">Total Distance:</span>
                  <span>1500-5000 yards/meters</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-yellow-400 font-semibold min-w-fit">Focus:</span>
                  <span>Sprint, endurance, technique, IM, recovery, race prep</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-yellow-400 font-semibold min-w-fit">Time Available:</span>
                  <span>45 min, 60 min, 90 min</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-yellow-400 font-semibold min-w-fit">Special Requests:</span>
                  <span>Equipment, stroke focus, energy systems</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-yellow-400 font-semibold min-w-fit">Pool Length:</span>
                  <span>25y, 25m, 50m (if relevant)</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h5 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                Example prompts:
              </h5>
              <div className="space-y-4">
                <div className="p-4 bg-background-secondary rounded-xl border border-gray-600/50">
                  <p className="text-sm text-gray-300 leading-relaxed italic">
                    "Generate a 3000 yard workout for competitive high school swimmers focusing on sprint
                    freestyle with emphasis on underwater work"
                  </p>
                </div>
                <div className="p-4 bg-background-secondary rounded-xl border border-gray-600/50">
                  <p className="text-sm text-gray-300 leading-relaxed italic">
                    "Create an endurance workout for masters swimmers 45-55 age group, focus on technique,
                    2500 yards total"
                  </p>
                </div>
                <div className="p-4 bg-background-secondary rounded-xl border border-gray-600/50">
                  <p className="text-sm text-gray-300 leading-relaxed italic">
                    "Design a race-specific workout for 100 butterfly championship, include pace work and
                    technique drills, 3200 yards"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}