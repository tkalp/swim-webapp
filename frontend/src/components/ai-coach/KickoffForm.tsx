import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { KickoffParams } from '@/types/ai-coach/types';

interface KickoffFormProps {
  onSubmit: (prompt: string, params?: KickoffParams) => void;
  disabled?: boolean;
}

const FOCUS_OPTIONS = ['Sprint', 'Endurance', 'Technique', 'IM', 'Kick', 'Recovery', 'Race Prep'];
const LEVEL_OPTIONS = ['Age Group', 'Senior', 'Masters'];
const STROKE_OPTIONS = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'IM', 'Mixed'];
const DISTANCE_OPTIONS = [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000];

function ButtonGroup({
  options,
  selected,
  onSelect,
  label,
}: {
  options: string[];
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
  label: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected === option}
            onClick={() => onSelect(selected === option ? undefined : option)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selected === option
                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function KickoffForm({ onSubmit, disabled = false }: KickoffFormProps) {
  const [prompt, setPrompt] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [params, setParams] = useState<KickoffParams>({});

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    // Build enhanced prompt from params
    const parts: string[] = [trimmed];
    if (params.training_focus) parts.push(`Focus: ${params.training_focus}`);
    if (params.target_distance) parts.push(`Target distance: ${params.target_distance}m`);
    if (params.level) parts.push(`Level: ${params.level}`);
    if (params.stroke_emphasis) parts.push(`Stroke emphasis: ${params.stroke_emphasis}`);

    const fullPrompt = parts.length > 1 ? parts.join('. ') + '.' : trimmed;
    const hasParams = Object.values(params).some(Boolean);
    onSubmit(fullPrompt, hasParams ? params : undefined);
  }, [prompt, params, onSubmit]);

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center mb-6">
          <Sparkles className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-slate-100">AI Workout Coach</h2>
          <p className="text-sm text-slate-400 mt-1">Describe the workout you need and I'll create it for you</p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 3000m sprint workout for senior swimmers focusing on freestyle..."
          disabled={disabled}
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => setShowContext(!showContext)}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          {showContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Add more context
        </button>

        {showContext && (
          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <ButtonGroup
              label="Training Focus"
              options={FOCUS_OPTIONS}
              selected={params.training_focus}
              onSelect={(v) => setParams((p) => ({ ...p, training_focus: v }))}
            />
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Target Distance</label>
              <select
                value={params.target_distance ?? ''}
                onChange={(e) =>
                  setParams((p) => ({
                    ...p,
                    target_distance: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="">No preference</option>
                {DISTANCE_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}m
                  </option>
                ))}
              </select>
            </div>
            <ButtonGroup
              label="Level"
              options={LEVEL_OPTIONS}
              selected={params.level}
              onSelect={(v) => setParams((p) => ({ ...p, level: v }))}
            />
            <ButtonGroup
              label="Stroke Emphasis"
              options={STROKE_OPTIONS}
              selected={params.stroke_emphasis}
              onSelect={(v) => setParams((p) => ({ ...p, stroke_emphasis: v }))}
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={disabled || !prompt.trim()}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-medium hover:from-cyan-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate Workout
        </button>
      </div>
    </div>
  );
}
