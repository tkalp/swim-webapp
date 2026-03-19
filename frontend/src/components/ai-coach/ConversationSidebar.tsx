import { useState, useCallback } from 'react';
import { Plus, Trash2, MessageSquare, X } from 'lucide-react';
import type { Conversation } from '@/types/ai-coach/types';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen?: boolean;     // mobile drawer state
  onClose?: () => void; // mobile drawer close
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen = false,
  onClose,
}: ConversationSidebarProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = useCallback((id: string) => {
    onDelete(id);
    setDeleteConfirmId(null);
  }, [onDelete]);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    onClose?.(); // Close mobile drawer on select
  }, [onSelect, onClose]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header with New Chat button */}
      <div className="p-3 border-b border-slate-800">
        <button
          onClick={() => { onNew(); onClose?.(); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No conversations yet</p>
          </div>
        ) : (
          <div className="py-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${
                  activeId === conv.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                }`}
                onClick={() => handleSelect(conv.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">
                      {conv.title || 'Untitled conversation'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatRelativeTime(conv.updated_at)}
                    </p>
                  </div>

                  {deleteConfirmId === conv.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        className="px-2 py-0.5 text-xs rounded bg-red-600 text-white hover:bg-red-500"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-0.5 text-xs rounded border border-slate-700 text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1"
                      aria-label={`Delete ${conv.title || 'conversation'}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 bg-slate-900 border-r border-slate-800 h-full">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-slate-900 z-50 md:hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <span className="text-sm font-medium text-slate-200">Conversations</span>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-49px)]">
              {sidebarContent}
            </div>
          </div>
        </>
      )}
    </>
  );
}
