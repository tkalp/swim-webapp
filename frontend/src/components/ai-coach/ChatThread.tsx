import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import type { Message, WorkoutSections } from '@/types/ai-coach/types';

interface ChatThreadProps {
  messages: Message[];
  isGenerating: boolean;
  onSave?: () => void;
  onQuickAction?: (action: string) => void;
  onEditSection?: (sections: WorkoutSections) => void;
}

export function ChatThread({
  messages,
  isGenerating,
  onSave,
  onQuickAction,
  onEditSection,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

  if (messages.length === 0 && !isGenerating) {
    return null; // KickoffForm will be shown instead
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6" aria-live="polite">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === 'assistant' &&
            index === messages.length - 1;

          return (
            <ChatMessage
              key={message.id}
              message={message}
              isLatest={isLastAssistant}
              onSave={isLastAssistant ? onSave : undefined}
              onQuickAction={isLastAssistant ? onQuickAction : undefined}
              onEditSection={isLastAssistant ? onEditSection : undefined}
            />
          );
        })}

        {isGenerating && (
          <div className="flex items-center gap-2 text-slate-400 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating workout...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
