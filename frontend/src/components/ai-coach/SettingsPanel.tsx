// components/ai-coach/SettingsPanel.tsx
import type { AICoachSettings } from '../../types/ai-coach/types'

interface SettingsPanelProps {
  settings: AICoachSettings
  onUpdate: (updates: Partial<AICoachSettings>) => void
}

export default function SettingsPanel({ settings, onUpdate }: SettingsPanelProps) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
          LLM Provider
        </label>
        <select
          className="w-full px-4 py-3 bg-background-secondary border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-300 hover:border-gray-500"
          value={settings.provider}
          onChange={(e) => onUpdate({ provider: e.target.value as 'claude' | 'openai' })}
        >
          <option value="claude">Claude (Anthropic)</option>
          <option value="openai">GPT-4 (OpenAI)</option>
          <option value="groq">Groq LLM (Groq)</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
          API Key
        </label>
        <input
          type="password"
          className="w-full px-4 py-3 bg-background-secondary border border-gray-600 rounded-xl text-white placeholder:text-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-300 hover:border-gray-500"
          placeholder={settings.provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
          value={settings.apiKey}
          onChange={(e) => onUpdate({ apiKey: e.target.value })}
        />
        <small className="text-xs text-gray-400 leading-relaxed">
          Get your key from{' '}
          {settings.provider === 'claude' ? (
            <a 
              href="https://console.anthropic.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors duration-300"
            >
              console.anthropic.com
            </a>
          ) : (
            <a 
              href="https://platform.openai.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors duration-300"
            >
              platform.openai.com
            </a>
          )}
        </small>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Example Workouts
        </label>
        <div className="space-y-3">
          <input
            type="range"
            min="1"
            max="10"
            value={settings.numExamples}
            onChange={(e) => onUpdate({ numExamples: Number(e.target.value) })}
            className="w-full h-2 bg-background-tertiary rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-linear-to-r 
              [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-purple-500 
              [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg 
              [&::-webkit-slider-thumb]:shadow-cyan-500/40 [&::-webkit-slider-thumb]:transition-transform 
              [&::-webkit-slider-thumb]:duration-200 hover:[&::-webkit-slider-thumb]:scale-110
              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full 
              [&::-moz-range-thumb]:bg-linear-to-r [&::-moz-range-thumb]:from-cyan-500 
              [&::-moz-range-thumb]:to-purple-500 [&::-moz-range-thumb]:cursor-pointer 
              [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-lg"
          />
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-cyan-400">{settings.numExamples} examples</span>
          </div>
          <small className="text-xs text-gray-400 leading-relaxed">
            Number of similar workouts to use as reference
          </small>
        </div>
      </div>
    </div>
  )
}