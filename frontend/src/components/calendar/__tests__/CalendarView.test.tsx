import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CalendarView } from '../CalendarView'
import type { CalendarEvent } from '@/types/calendar'

// Mock react-big-calendar since it has complex CSS + DOM requirements
vi.mock('react-big-calendar', () => ({
  Calendar: ({ events }: { events: any[] }) => (
    <div data-testid="big-calendar">
      {events.map((e: any) => (
        <div key={e.id} data-testid="calendar-event">
          {e.title}
        </div>
      ))}
    </div>
  ),
  dateFnsLocalizer: () => ({}),
}))

// Mock CSS import
vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}))

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date: Date, fmt: string) => date.toString()),
  parse: vi.fn(),
  startOfWeek: vi.fn(),
  getDay: vi.fn(),
}))

vi.mock('date-fns/locale', () => ({
  enUS: {},
}))

const mockEvent: CalendarEvent = {
  id: 'event-1',
  name: 'Team Practice',
  start_date: '2024-03-15T09:00:00Z',
  end_date: '2024-03-15T11:00:00Z',
  event_type: 'practice',
  squad_id: 'squad-1',
}

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<CalendarView events={[]} />)
    expect(document.body).toBeTruthy()
  })

  it('renders the calendar component', () => {
    render(<CalendarView events={[]} />)
    expect(screen.getByTestId('big-calendar')).toBeInTheDocument()
  })

  it('renders events in the calendar', () => {
    render(<CalendarView events={[mockEvent]} />)
    expect(screen.getByTestId('calendar-event')).toBeInTheDocument()
    expect(screen.getByText('Team Practice')).toBeInTheDocument()
  })

  it('renders with multiple events', () => {
    const events: CalendarEvent[] = [
      mockEvent,
      {
        id: 'event-2',
        name: 'Swim Meet',
        start_date: '2024-03-20T08:00:00Z',
        end_date: '2024-03-20T17:00:00Z',
        event_type: 'meet',
        squad_id: 'squad-1',
      },
    ]
    render(<CalendarView events={events} />)
    const eventEls = screen.getAllByTestId('calendar-event')
    expect(eventEls).toHaveLength(2)
  })

  it('renders with empty events array', () => {
    render(<CalendarView events={[]} />)
    expect(screen.queryByTestId('calendar-event')).not.toBeInTheDocument()
  })
})
