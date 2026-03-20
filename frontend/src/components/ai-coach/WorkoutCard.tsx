import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, CheckCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import { WorkoutSection } from './WorkoutSection';
import { QuickActions } from './QuickActions';
import { parseWorkoutSections } from '@/utils/parseWorkoutSections';
import { splitWorkoutText, stripMarkdown, stripNotesHeader } from '@/utils/cleanWorkoutText';
import type { WorkoutSections as WorkoutSectionsType } from '@/types/ai-coach/types';

interface WorkoutCardProps {
  content: string;
  isLatest: boolean;
  savedTitle?: string;
  conversationId?: string;
  messageId?: string;
  onQuickAction?: (action: string) => void;
  onEditSection?: (sections: WorkoutSectionsType) => void;
}

const SECTION_LABELS: Record<string, string> = {
  warmup: 'Warm-up',
  preset: 'Pre-set',
  main: 'Main Set',
  cooldown: 'Cool-down',
};

export function WorkoutCard({
  content,
  isLatest,
  savedTitle,
  conversationId,
  messageId,
  onQuickAction,
  onEditSection,
}: WorkoutCardProps) {
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(!!savedTitle);
  const [savedName, setSavedName] = useState(savedTitle || '');
  const sections = parseWorkoutSections(content);

  const handleSectionEdit = (key: string, newContent: string) => {
    if (onEditSection) {
      onEditSection({ ...sections, [key]: newContent });
    }
  };

  const handleSaveAsWorkout = () => {
    const { workout, notes } = splitWorkoutText(content);
    const cleanedWorkout = stripMarkdown(workout);
    const coachingNotes = notes ? stripNotesHeader(notes) : '';

    navigate('/workouts/create', {
      state: {
        workoutText: cleanedWorkout,
        coachingNotes,
        conversationId,
        messageId,
      },
    });
  };

  const renderSections = () => {
    if (sections.raw) {
      return (
        <div className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-slate-200 prose-strong:text-slate-100 prose-code:text-cyan-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded">
          <Markdown>{sections.raw}</Markdown>
        </div>
      );
    }

    return (
      <>
        {Object.entries(sections).map(([key, value]) => {
          if (!value || key === 'raw') return null;
          return (
            <WorkoutSection
              key={key}
              title={SECTION_LABELS[key] || key}
              content={value}
              editable={isLatest}
              onEdit={(newContent) => handleSectionEdit(key, newContent)}
            />
          );
        })}
      </>
    );
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      {renderSections()}

      {isLatest && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
          {onQuickAction && (
            <QuickActions onAction={onQuickAction} disabled={false} />
          )}

          <div className="flex items-center gap-3">
            {!isSaved ? (
              <button
                onClick={handleSaveAsWorkout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 text-white text-sm font-medium hover:from-cyan-500 hover:to-cyan-400 transition-all"
              >
                <Save className="h-4 w-4" />
                Save as Workout
              </button>
            ) : (
              <span className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                {savedName ? `Saved as "${savedName}"` : 'Saved'}
              </span>
            )}
          </div>
        </div>
      )}

      {!isLatest && savedTitle && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle className="h-3.5 w-3.5" />
            Saved as "{savedTitle}"
          </span>
        </div>
      )}

    </div>
  );
}
