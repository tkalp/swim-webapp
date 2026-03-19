import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  sendMessage,
} from '@/services/aiCoachService';
import type { Conversation, Message, KickoffParams } from '@/types/ai-coach/types';

const CONVERSATIONS_KEY = ['ai-coach', 'conversations'];

export function useAICoach() {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch conversation list for sidebar
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
  } = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: listConversations,
  });

  // Create conversation mutation
  const createMutation = useMutation({
    mutationFn: (title?: string) => createConversation(title),
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      setActiveConversationId(newConversation.id);
      setMessages([]);
    },
  });

  // Delete conversation mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
  });

  // Select a conversation and load its messages
  const selectConversation = useCallback(async (id: string) => {
    try {
      const data = await getConversation(id);
      setActiveConversationId(id);
      setMessages(data.messages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  }, []);

  // Send a message in the active conversation
  const handleSendMessage = useCallback(async (
    content: string,
    metadata?: { kickoff_params?: KickoffParams }
  ) => {
    if (!content.trim()) return;

    let conversationId = activeConversationId;

    // Auto-create conversation if none active
    if (!conversationId) {
      try {
        const newConversation = await createConversation();
        conversationId = newConversation.id;
        setActiveConversationId(conversationId);
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      } catch (err) {
        console.error('Failed to create conversation:', err);
        return;
      }
    }

    // Optimistically add coach message
    const optimisticCoachMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: 'coach',
      content,
      metadata: metadata || null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticCoachMessage]);
    setIsGenerating(true);

    try {
      const result = await sendMessage(conversationId, content, metadata);
      // Replace optimistic message with real one and add assistant response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticCoachMessage.id),
        result.coach_message,
        result.assistant_message,
      ]);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    } catch (err) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticCoachMessage.id));
      console.error('Failed to send message:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [activeConversationId, queryClient]);

  // Start a new chat (clear active conversation)
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  return {
    // State
    conversations,
    isLoadingConversations,
    activeConversationId,
    messages,
    isGenerating,

    // Actions
    createConversation: createMutation.mutateAsync,
    deleteConversation: deleteMutation.mutateAsync,
    selectConversation,
    sendMessage: handleSendMessage,
    startNewChat,
  };
}
