import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { WorkoutMetricsCard } from '../WorkoutMetricsCard';

const mockAnalysis = {
  parser_used: 'llm' as const,
  total_meters: 3200,
  total_sets: 14,
  estimated_duration_minutes: 55,
  stroke_breakdown: {
    freestyle: { meters: 2400, percentage: 75.0 },
    backstroke: { meters: 800, percentage: 25.0 },
  },
  activity_breakdown: {
    swim: { meters: 2600, percentage: 81.3 },
    kick: { meters: 600, percentage: 18.8 },
  },
  energy_zone_breakdown: {
    en1: { meters: 800, percentage: 25.0 },
    en2: { meters: 2400, percentage: 75.0 },
  },
  sections: [],
};

describe('WorkoutMetricsCard', () => {
  it('renders summary metrics', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);
    expect(screen.getByText('3,200m')).toBeInTheDocument();
    expect(screen.getByText('14 sets')).toBeInTheDocument();
    expect(screen.getByText('55m')).toBeInTheDocument();
  });

  it('renders stroke breakdown with icons and bars', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);
    expect(screen.getByText('Freestyle')).toBeInTheDocument();
    expect(screen.getByText('Backstroke')).toBeInTheDocument();
    expect(screen.getByText('2400m')).toBeInTheDocument();
    expect(screen.getByText('800m')).toBeInTheDocument();
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders activity breakdown with bars', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);
    expect(screen.getByText('swim')).toBeInTheDocument();
    expect(screen.getByText('kick')).toBeInTheDocument();
    expect(screen.getByText('2600m')).toBeInTheDocument();
    expect(screen.getByText('600m')).toBeInTheDocument();
  });

  it('renders energy zone pills', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);
    expect(screen.getByText('EN1')).toBeInTheDocument();
    expect(screen.getByText('EN2')).toBeInTheDocument();
  });

  it('shows stale badge when isStale', () => {
    render(<WorkoutMetricsCard analysis={mockAnalysis} isStale={true} />);
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('shows regex fallback notice', () => {
    const regexAnalysis = { ...mockAnalysis, parser_used: 'regex' as const };
    render(<WorkoutMetricsCard analysis={regexAnalysis} />);
    expect(screen.getByText(/approximate/i)).toBeInTheDocument();
  });

  it('renders nothing when analysis is null', () => {
    const { container } = render(<WorkoutMetricsCard analysis={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('collapses and shows summary when header is clicked', async () => {
    const user = userEvent.setup();
    render(<WorkoutMetricsCard analysis={mockAnalysis} />);

    // Initially expanded - should show Distance label
    expect(screen.getByText('Distance')).toBeInTheDocument();

    // Click header to collapse
    const header = screen.getByRole('button');
    await user.click(header);

    // Should show summary text in collapsed header
    expect(screen.getByText(/3200m/)).toBeInTheDocument();
    // Distance card should be gone
    expect(screen.queryByText('Distance')).not.toBeInTheDocument();
  });
});
