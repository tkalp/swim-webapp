// components/ai-coach/TemplateSelector.tsx
import { WORKOUT_TEMPLATES } from '@/services/aiCoachService'

interface TemplateSelectorProps {
  onSelect: (prompt: string) => void
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Quick Templates
      </h4>
      <div className="flex flex-wrap gap-2">
        {WORKOUT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="px-3 py-2 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700 hover:border-cyan-500 rounded-lg text-slate-300 hover:text-cyan-400 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-cyan-500/10 active:translate-y-0 whitespace-nowrap"
            onClick={() => onSelect(template.prompt)}
            title={template.prompt}
          >
            {template.name}
          </button>
        ))}
      </div>
    </div>
  )
}