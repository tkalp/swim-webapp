import { MessageSquare } from 'lucide-react';
import Markdown from 'react-markdown';
import { WorkoutMetricsCard } from '@/components/workout/WorkoutMetricsCard';
import { normalizeToWorkoutAnalysis } from '@/utils/normalizeWorkoutData';

interface WorkoutStructuredViewProps {
  jsonDescription?: Record<string, any>;
  rawDescription?: string;
  description?: string;
}

/** Check if text contains markdown formatting */
function hasMarkdown(text: string): boolean {
  return /(?:^#{1,4}\s|\*\*|^[-*]\s|^\d+\.\s|`[^`]+`|^>)/m.test(text);
}

export function WorkoutStructuredView({
  jsonDescription,
  rawDescription,
  description,
}: WorkoutStructuredViewProps) {
  const analysis = normalizeToWorkoutAnalysis(jsonDescription);

  if (!rawDescription && !analysis) return null;

  return (
    <div className="space-y-5">
      {/* Metrics (from parsed analysis data) */}
      {analysis && <WorkoutMetricsCard analysis={analysis} />}

      {/* Workout Text */}
      {rawDescription && (
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 overflow-hidden">
          <div className="p-5">
            {hasMarkdown(rawDescription) ? (
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-cyan-400 prose-headings:text-sm prose-headings:font-semibold prose-headings:uppercase prose-headings:tracking-wide prose-strong:text-slate-100 prose-code:text-cyan-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded prose-hr:border-slate-700/50">
                <Markdown>{rawDescription}</Markdown>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-300">
                {rawDescription}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Coaching Notes (separate from workout text) */}
      {description && (
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={14} className="text-cyan-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Coaching Notes</span>
          </div>
          <div className="space-y-1.5">
            {description.split('\n').filter(l => l.trim()).map((line, i) => (
              <p key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2">
                <span className="text-slate-500 select-none shrink-0">•</span>
                <span>{line.replace(/^[-•]\s*/, '')}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
