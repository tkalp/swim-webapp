import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SaveWorkoutModal } from '../SaveWorkoutModal';

// Mock the hooks and services
vi.mock('@/hooks/useWorkoutAnalysis', () => ({
  useWorkoutAnalysis: () => ({
    analysis: {
      parser_used: 'llm',
      total_meters: 1400,
      total_sets: 4,
      estimated_duration_minutes: 35,
      stroke_breakdown: {},
      activity_breakdown: {},
      energy_zone_breakdown: {},
      sections: [],
    },
    isAnalyzing: false,
    isStale: false,
    error: null,
    analyze: vi.fn(),
    markStale: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock('@/lib/apiClient', () => ({
  authenticatedFetch: vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
}));

vi.mock('@/services/workoutTemplateService', () => ({
  createWorkoutTemplate: vi.fn().mockResolvedValue({ id: 'workout-789' }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'coach@test.com' },
  }),
}));

describe('SaveWorkoutModal', () => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    workoutText: '4x100 Free @1:30\n200 choice easy',
    conversationId: 'conv-123',
    messageId: 'msg-456',
  };

  it('renders when open', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByText(/save workout/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<SaveWorkoutModal {...props} isOpen={false} />);
    expect(screen.queryByText(/save workout/i)).not.toBeInTheDocument();
  });

  it('has name input and save button', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/workout name/i)).toBeInTheDocument();
  });

  it('displays workout text', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByText(/4x100 Free/)).toBeInTheDocument();
  });

  it('shows classification dropdown', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByLabelText(/classification/i)).toBeInTheDocument();
  });

  it('shows effort level slider', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByLabelText(/effort level/i)).toBeInTheDocument();
  });

  it('shows visibility select', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByLabelText(/visibility/i)).toBeInTheDocument();
  });

  it('shows analysis metrics', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByText('1400m')).toBeInTheDocument();
    expect(screen.getByText('4 sets')).toBeInTheDocument();
    expect(screen.getByText('~35 min')).toBeInTheDocument();
  });

  it('has cancel button', () => {
    render(<SaveWorkoutModal {...props} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
