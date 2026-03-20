import { WorkoutCard } from './WorkoutCard';
import type { Message, WorkoutSections } from '@/types/ai-coach/types';

interface ChatMessageProps {
  message: Message;
  isLatest: boolean;
  onQuickAction?: (action: string) => void;
  onEditSection?: (sections: WorkoutSections) => void;
}

export function ChatMessage({
  message,
  isLatest,
  onQuickAction,
  onEditSection,
}: ChatMessageProps) {
  if (message.role === 'coach') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-lg border-l-2 border-cyan-500 bg-slate-900/30 px-4 py-3">
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message — delegate to WorkoutCard
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-3xl">
        <WorkoutCard
          content={message.content}
          isLatest={isLatest}
          savedTitle={message.metadata?.saved_workout_title}
          conversationId={message.conversation_id}
          messageId={message.id}
          onQuickAction={isLatest ? onQuickAction : undefined}
          onEditSection={isLatest ? onEditSection : undefined}
        />
      </div>
    </div>
  );
}
