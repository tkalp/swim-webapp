import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutStructuredView } from '../WorkoutStructuredView';

// Mock WorkoutMetricsCard to avoid chart complexity
vi.mock('@/components/workout/WorkoutMetricsCard', () => ({
  WorkoutMetricsCard: ({ analysis }: any) =>
    analysis ? <div data-testid="metrics-card">Metrics: {analysis.total_meters}m</div> : null,
}));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

const mockJsonDescription = {
  sections: [
    {
      name: 'Warm-up',
      sets: [{ reps: 4, distance: 100, stroke: 'freestyle', activity: 'swim', energy_zone: 'en1' }],
    },
  ],
  totals: {
    total_meters: 400,
    total_sets: 1,
    estimated_duration_minutes: 8,
    rest_time_minutes: 0,
    stroke_breakdown: { freestyle: { meters: 400, percentage: 100 } },
    activity_breakdown: { swim: { meters: 400, percentage: 100 } },
    energy_zone_breakdown: { en1: { meters: 400, percentage: 100 } },
  },
};

describe('WorkoutStructuredView', () => {
  it('renders metrics card when jsonDescription provided', () => {
    render(
      <WorkoutStructuredView
        jsonDescription={mockJsonDescription}
        rawDescription="4x100 Free @ 2:00"
      />
    );
    expect(screen.getByTestId('metrics-card')).toBeInTheDocument();
    expect(screen.getByText('Metrics: 400m')).toBeInTheDocument();
  });

  it('renders raw text as preformatted when no markdown', () => {
    render(<WorkoutStructuredView rawDescription="4x100 Free @ 1:30" />);
    const pre = screen.getByText('4x100 Free @ 1:30');
    expect(pre.tagName).toBe('PRE');
  });

  it('renders markdown through react-markdown when markdown detected', () => {
    render(<WorkoutStructuredView rawDescription="### Warm-up\n- 4x100 Free" />);
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('shows coaching notes separately', () => {
    render(
      <WorkoutStructuredView
        rawDescription="4x100 Free"
        description="Focus on high elbows during catch phase"
      />
    );
    expect(screen.getByText('Coaching Notes')).toBeInTheDocument();
    expect(screen.getByText('Focus on high elbows during catch phase')).toBeInTheDocument();
  });

  it('renders coaching notes as bullet points when multiline', () => {
    const notes = ['Focus on high elbows', 'Keep steady kick', 'Breathe every 3'].join('\n');
    render(
      <WorkoutStructuredView
        rawDescription="4x100 Free"
        description={notes}
      />
    );
    expect(screen.getAllByText('•')).toHaveLength(3);
  });

  it('returns null when no rawDescription and no analysis', () => {
    const { container } = render(<WorkoutStructuredView />);
    expect(container.firstChild).toBeNull();
  });

  it('renders without metrics when no jsonDescription', () => {
    render(<WorkoutStructuredView rawDescription="4x100 Free" />);
    expect(screen.queryByTestId('metrics-card')).not.toBeInTheDocument();
    expect(screen.getByText('4x100 Free')).toBeInTheDocument();
  });

  it('renders both metrics and text when both provided', () => {
    render(
      <WorkoutStructuredView
        jsonDescription={mockJsonDescription}
        rawDescription="4x100 Free @ 2:00"
        description="Easy swim"
      />
    );
    expect(screen.getByTestId('metrics-card')).toBeInTheDocument();
    expect(screen.getByText('4x100 Free @ 2:00')).toBeInTheDocument();
    expect(screen.getByText('Easy swim')).toBeInTheDocument();
  });
});
