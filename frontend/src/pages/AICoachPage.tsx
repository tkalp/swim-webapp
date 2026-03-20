import { useState, useCallback } from 'react';
import { History } from 'lucide-react';
import { useAICoach } from '@/hooks/useAICoach';
import { ConversationSidebar } from '@/components/ai-coach/ConversationSidebar';
import { ChatThread } from '@/components/ai-coach/ChatThread';
import { ChatInput } from '@/components/ai-coach/ChatInput';
import { KickoffForm } from '@/components/ai-coach/KickoffForm';
import type { KickoffParams, WorkoutSections } from '@/types/ai-coach/types';

export default function AICoachPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    conversations,
    activeConversationId,
    messages,
    isGenerating,
    selectConversation,
    deleteConversation,
    sendMessage,
    startNewChat,
  } = useAICoach();

  const hasMessages = messages.length > 0;

  const handleKickoff = useCallback(async (prompt: string, params?: KickoffParams) => {
    try {
      await sendMessage(prompt, params ? { kickoff_params: params } : undefined);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  }, [sendMessage]);

  const handleSendMessage = useCallback(async (content: string) => {
    try {
      await sendMessage(content);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [sendMessage]);

  const handleQuickAction = useCallback(async (action: string) => {
    const actionMessages: Record<string, string> = {
      harder: 'Make this workout harder — increase intensity, shorter rest intervals, or add more challenging sets.',
      easier: 'Make this workout easier — reduce intensity, longer rest intervals, or simplify the sets.',
      'add-kick': 'Add a dedicated kick set to this workout.',
      'add-drill': 'Add drill work to this workout for technique improvement.',
      shorten: 'Shorten this workout while keeping the key elements.',
      lengthen: 'Lengthen this workout — add more volume while maintaining the focus.',
    };

    const message = actionMessages[action];
    if (message) {
      try {
        await sendMessage(message);
      } catch (err) {
        console.error('Failed to send quick action:', err);
      }
    }
  }, [sendMessage]);

  const handleEditSection = useCallback((_sections: WorkoutSections) => {
    // Section editing will update the message metadata in a future iteration
    // For now, the edit is visual-only within the WorkoutSection component
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={selectConversation}
        onNew={startNewChat}
        onDelete={deleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Open conversation history"
          >
            <History className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium text-slate-200 truncate">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title || 'AI Coach'
              : 'AI Coach'}
          </h1>
        </div>

        {/* Chat content */}
        {hasMessages || isGenerating ? (
          <>
            <ChatThread
              messages={messages}
              isGenerating={isGenerating}
              onQuickAction={handleQuickAction}
              onEditSection={handleEditSection}
            />
            <ChatInput
              onSend={handleSendMessage}
              disabled={isGenerating}
              placeholder="Refine this workout or ask for changes..."
            />
          </>
        ) : (
          <KickoffForm onSubmit={handleKickoff} disabled={isGenerating} />
        )}
      </div>
    </div>
  );
}
