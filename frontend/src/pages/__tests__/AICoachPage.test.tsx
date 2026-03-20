import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockUseAICoach = vi.fn()

vi.mock('@/hooks/useAICoach', () => ({
  useAICoach: () => mockUseAICoach(),
}))

vi.mock('@/components/ai-coach/ConversationSidebar', () => ({
  ConversationSidebar: () => <div data-testid="conversation-sidebar" />,
}))

vi.mock('@/components/ai-coach/ChatThread', () => ({
  ChatThread: () => <div data-testid="chat-thread" />,
}))

vi.mock('@/components/ai-coach/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}))

vi.mock('@/components/ai-coach/KickoffForm', () => ({
  KickoffForm: () => <div data-testid="kickoff-form" />,
}))

import AICoachPage from '../AICoachPage'

const baseHookState = {
  conversations: [],
  isLoadingConversations: false,
  activeConversationId: null,
  messages: [],
  isGenerating: false,
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  selectConversation: vi.fn(),
  sendMessage: vi.fn(),
  startNewChat: vi.fn(),
}

describe('AICoachPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAICoach.mockReturnValue(baseHookState)
  })

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('renders the conversation sidebar', () => {
    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('conversation-sidebar')).toBeInTheDocument()
  })

  it('renders KickoffForm when there are no messages and not generating', () => {
    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('kickoff-form')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-thread')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
  })

  it('renders ChatThread and ChatInput when messages exist', () => {
    mockUseAICoach.mockReturnValue({
      ...baseHookState,
      activeConversationId: 'conv-1',
      messages: [
        {
          id: 'msg-1',
          conversation_id: 'conv-1',
          role: 'coach',
          content: 'Create a sprint workout',
          metadata: null,
          created_at: new Date().toISOString(),
        },
      ],
    })

    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('chat-thread')).toBeInTheDocument()
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.queryByTestId('kickoff-form')).not.toBeInTheDocument()
  })

  it('renders ChatThread and ChatInput when isGenerating is true (even with no messages)', () => {
    mockUseAICoach.mockReturnValue({
      ...baseHookState,
      isGenerating: true,
    })

    render(
      <MemoryRouter>
        <AICoachPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('chat-thread')).toBeInTheDocument()
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.queryByTestId('kickoff-form')).not.toBeInTheDocument()
  })
})
