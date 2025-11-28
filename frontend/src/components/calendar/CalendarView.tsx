// components/calendar/CalendarView.tsx
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Trophy, Waves, CalendarDays } from 'lucide-react'
import type { CalendarEvent } from '@/types/calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = {
  'en-US': enUS
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface CalendarViewProps {
  events: CalendarEvent[]
  onSelectEvent?: (event: CalendarEvent) => void
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void
  view?: View
  onViewChange?: (view: View) => void
  date?: Date
  onNavigate?: (date: Date) => void
}

export function CalendarView({
  events,
  onSelectEvent,
  onSelectSlot,
  view = 'month',
  onViewChange,
  date,
  onNavigate
}: CalendarViewProps) {
  
  // Transform events for react-big-calendar
  const calendarEvents = useMemo(() => {
    return events.map(event => ({
      id: event.id,
      title: event.name || 'Untitled Event',
      start: new Date(event.start_date || ''),
      end: new Date(event.end_date || ''),
      resource: event,
      type: event.event_type
    }))
  }, [events])
  
  // Custom event style based on event type
  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#06b6d4'
    let borderColor = '#22D3EE'
    let Icon = CalendarDays
    
    if (event.type === 'meet') {
      backgroundColor = '#f43f5e'
      borderColor = '#fb7185'
      Icon = Trophy
    } else if (event.type === 'practice') {
      backgroundColor = '#14b8a6'
      borderColor = '#2dd4bf'
      Icon = Waves
    } else if (event.type === 'other') {
      backgroundColor = '#c026d3'
      borderColor = '#e879f9'
      Icon = CalendarDays
    }
    
    return {
      style: {
        backgroundColor,
        borderLeft: `5px solid ${borderColor}`,
        borderRadius: '8px',
        color: '#FFFFFF',
        fontSize: '13px',
        fontWeight: '700',
        padding: '6px 10px',
        boxShadow: `0 6px 16px ${backgroundColor}70, 0 0 0 1px rgba(255, 255, 255, 0.2)`,
        cursor: 'pointer',
        background: `linear-gradient(135deg, ${backgroundColor} 0%, ${backgroundColor}dd 100%)`,
      }
    }
  }
  
  // Custom toolbar with icons
  const CustomToolbar = (toolbar: any) => {
    const goToBack = () => toolbar.onNavigate('PREV')
    const goToNext = () => toolbar.onNavigate('Next')
    const goToToday = () => toolbar.onNavigate('TODAY')
    
    return (
      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 mb-4 sm:mb-5 border-b border-cyan-500/20">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-start">
          <button
            onClick={goToBack}
            className="p-2 sm:p-2.5 rounded-xl bg-gray-800/60 border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-400/40 transition-all duration-200 text-gray-400 hover:text-cyan-400 group backdrop-blur-sm"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
          </button>
          <button
            onClick={goToToday}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/30 hover:from-cyan-500/20 hover:to-teal-500/20 hover:border-cyan-400/50 transition-all duration-200 text-cyan-400 font-semibold text-xs sm:text-sm backdrop-blur-sm shadow-lg shadow-cyan-500/10"
          >
            Today
          </button>
          <button
            onClick={goToNext}
            className="p-2 sm:p-2.5 rounded-xl bg-gray-800/60 border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-400/40 transition-all duration-200 text-gray-400 hover:text-cyan-400 group backdrop-blur-sm"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent tracking-tight w-full sm:w-auto text-center">
          {toolbar.label}
        </h2>
        
        <div className="flex gap-1.5 sm:gap-2 bg-gray-800/60 p-1 sm:p-1.5 rounded-xl border border-cyan-500/20 backdrop-blur-sm w-full sm:w-auto overflow-x-auto">
          {['month', 'week', 'day', 'agenda'].map(viewName => (
            <button
              key={viewName}
              onClick={() => toolbar.onView(viewName)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 capitalize whitespace-nowrap ${
                toolbar.view === viewName
                  ? 'bg-gradient-to-r from-cyan-500/30 to-teal-500/30 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30'
                  : 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/5'
              }`}
            >
              {viewName}
            </button>
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div className="calendar-container w-full h-full min-h-[700px] bg-gradient-to-br from-[#0A0B0F] via-[#111827] to-[#0A0B0F] rounded-2xl p-6 shadow-2xl border border-gray-800/50 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(34, 211, 238, 0.15) 1px, transparent 0)',
        backgroundSize: '32px 32px'
      }}></div>
      
      <div className="relative z-10">
      <style>{`
        /* Container styling */
        .calendar-container .rbc-calendar {
          background: transparent;
          color: #F8FAFC;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* Toolbar - Hidden since we use custom */
        .calendar-container .rbc-toolbar {
          display: none;
        }

        /* Month view */
        .calendar-container .rbc-month-view {
          background: rgba(17, 24, 39, 0.4);
          border: 1px solid rgba(49, 151, 167, 0.15);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .calendar-container .rbc-month-row {
          border: none;
          overflow: visible;
        }

        .calendar-container .rbc-header {
          background: linear-gradient(180deg, rgba(49, 151, 167, 0.15), rgba(49, 151, 167, 0.05));
          border-bottom: 2px solid rgba(34, 211, 238, 0.2);
          padding: 16px 8px;
          font-weight: 700;
          color: #22D3EE;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 1px;
        }

        .calendar-container .rbc-header + .rbc-header {
          border-left: 1px solid rgba(49, 151, 167, 0.1);
        }

        /* Date cells */
        .calendar-container .rbc-day-bg {
          background: rgba(10, 11, 15, 0.5);
          border-left: 1px solid rgba(31, 41, 55, 0.5);
          border-bottom: 1px solid rgba(31, 41, 55, 0.5);
          min-height: 110px;
          position: relative;
          transition: background 0.15s ease, box-shadow 0.15s ease;
        }

        .calendar-container .rbc-day-bg:hover {
          background: rgba(34, 211, 238, 0.08) !important;
          box-shadow: inset 0 0 20px rgba(34, 211, 238, 0.08);
        }

        .calendar-container .rbc-off-range-bg {
          background: rgba(10, 11, 15, 0.2);
          opacity: 0.5;
        }
        
        .calendar-container .rbc-off-range-bg:hover {
          background: rgba(10, 11, 15, 0.25) !important;
          box-shadow: none !important;
        }

        .calendar-container .rbc-today {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.18), rgba(20, 184, 166, 0.12)) !important;
          box-shadow: inset 0 0 40px rgba(34, 211, 238, 0.2), 0 0 0 1px rgba(34, 211, 238, 0.3);
          position: relative;
        }
        
        .calendar-container .rbc-today::before {
          content: '';
          position: absolute;
          top: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          background: linear-gradient(135deg, #22D3EE, #14b8a6);
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
        
        .calendar-container .rbc-today:hover {
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.22), rgba(20, 184, 166, 0.15)) !important;
          box-shadow: inset 0 0 50px rgba(34, 211, 238, 0.25), 0 0 0 1px rgba(34, 211, 238, 0.4);
        }

        .calendar-container .rbc-date-cell {
          padding: 12px;
          text-align: right;
        }

        .calendar-container .rbc-date-cell > a {
          color: #CBD5E1;
          font-weight: 600;
          font-size: 14px;
          padding: 6px 10px;
          border-radius: 10px;
          transition: all 0.2s ease;
          display: inline-block;
          min-width: 32px;
          text-align: center;
        }

        .calendar-container .rbc-date-cell > a:hover {
          background: rgba(34, 211, 238, 0.15);
          color: #22D3EE;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(34, 211, 238, 0.2);
        }

        .calendar-container .rbc-now > a {
          background: linear-gradient(135deg, #22D3EE, #14b8a6);
          color: #0A0B0F;
          font-weight: 800;
          box-shadow: 0 6px 16px rgba(34, 211, 238, 0.5);
          transform: scale(1.1);
        }
        
        .calendar-container .rbc-now > a:hover {
          box-shadow: 0 8px 20px rgba(34, 211, 238, 0.6);
          transform: scale(1.12);
        }

        .calendar-container .rbc-off-range > a {
          color: #4B5563;
          opacity: 0.4;
        }

        /* Events */
        .calendar-container .rbc-event {
          background: transparent;
          border: none;
          padding: 0;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .calendar-container .rbc-event:hover {
          transform: translateY(-2px) scale(1.02);
          z-index: 10;
        }

        .calendar-container .rbc-event:focus {
          outline: 2px solid #22D3EE;
          outline-offset: 2px;
        }

        .calendar-container .rbc-event-label {
          display: none;
        }

        .calendar-container .rbc-event-content {
          font-size: 13px;
          font-weight: 600;
          padding: 1px;
        }

        .calendar-container .rbc-show-more {
          background: linear-gradient(135deg, rgba(49, 151, 167, 0.3), rgba(34, 211, 238, 0.2));
          color: #22D3EE;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          margin: 4px 2px;
          border: 1px solid rgba(34, 211, 238, 0.3);
          transition: all 0.2s;
        }

        .calendar-container .rbc-show-more:hover {
          background: linear-gradient(135deg, rgba(49, 151, 167, 0.4), rgba(34, 211, 238, 0.3));
          box-shadow: 0 4px 12px rgba(34, 211, 238, 0.3);
          transform: translateY(-1px);
        }

        /* Week/Day view */
        .calendar-container .rbc-time-view {
          background: rgba(17, 24, 39, 0.4);
          border: 1px solid rgba(49, 151, 167, 0.15);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .calendar-container .rbc-time-header {
          border-bottom: 2px solid rgba(34, 211, 238, 0.2);
        }

        .calendar-container .rbc-time-header-content {
          border-left: 1px solid rgba(49, 151, 167, 0.2);
        }

        .calendar-container .rbc-time-content {
          border-top: none;
        }

        .calendar-container .rbc-time-slot {
          border-top: 1px solid rgba(31, 41, 55, 0.4);
          color: #6B7280;
          min-height: 40px;
        }

        .calendar-container .rbc-timeslot-group {
          min-height: 80px;
        }

        .calendar-container .rbc-time-gutter .rbc-timeslot-group {
          border-left: none;
          padding-right: 12px;
          font-weight: 600;
        }

        .calendar-container .rbc-day-slot {
          border-left: 1px solid rgba(31, 41, 55, 0.4);
        }

        .calendar-container .rbc-current-time-indicator {
          background: linear-gradient(90deg, #22D3EE, #3197a7);
          height: 3px;
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
        }

        /* Agenda view */
        .calendar-container .rbc-agenda-view {
          background: rgba(17, 24, 39, 0.4);
          border: 1px solid rgba(49, 151, 167, 0.15);
          border-radius: 16px;
          overflow: hidden;
        }

        .calendar-container .rbc-agenda-view table {
          border: none;
        }

        .calendar-container .rbc-agenda-date-cell,
        .calendar-container .rbc-agenda-time-cell {
          background: linear-gradient(180deg, rgba(49, 151, 167, 0.15), rgba(49, 151, 167, 0.05));
          border-right: 1px solid rgba(49, 151, 167, 0.2);
          padding: 16px;
          color: #22D3EE;
          font-weight: 700;
        }

        .calendar-container .rbc-agenda-event-cell {
          padding: 16px;
          color: #F8FAFC;
          font-weight: 500;
        }

        .calendar-container .rbc-agenda-table tbody > tr > td {
          border-bottom: 1px solid rgba(31, 41, 55, 0.4);
        }

        .calendar-container .rbc-agenda-table tbody > tr:hover {
          background: rgba(49, 151, 167, 0.08);
        }

        /* Overlay/Popup */
        .calendar-container .rbc-overlay {
          background: linear-gradient(135deg, #1F2937, #111827);
          border: 1px solid rgba(49, 151, 167, 0.3);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          padding: 12px;
        }

        .calendar-container .rbc-overlay-header {
          color: #22D3EE;
          font-weight: 700;
          border-bottom: 1px solid rgba(49, 151, 167, 0.2);
          padding-bottom: 12px;
          margin-bottom: 12px;
        }

        /* Selection */
        .calendar-container .rbc-selected {
          background: rgba(34, 211, 238, 0.15) !important;
        }

        .calendar-container .rbc-slot-selecting {
          background: rgba(34, 211, 238, 0.12);
          box-shadow: inset 0 0 20px rgba(34, 211, 238, 0.2);
        }

        /* Scrollbar */
        .calendar-container .rbc-time-content::-webkit-scrollbar {
          width: 10px;
        }

        .calendar-container .rbc-time-content::-webkit-scrollbar-track {
          background: rgba(10, 11, 15, 0.8);
          border-radius: 10px;
        }

        .calendar-container .rbc-time-content::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(49, 151, 167, 0.5), rgba(34, 211, 238, 0.5));
          border-radius: 10px;
          border: 2px solid rgba(10, 11, 15, 0.8);
        }

        .calendar-container .rbc-time-content::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(49, 151, 167, 0.7), rgba(34, 211, 238, 0.7));
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .calendar-container {
            min-height: 600px;
            padding: 16px;
          }
          
          .calendar-container .rbc-header {
            padding: 12px 4px;
            font-size: 10px;
          }
          
          .calendar-container .rbc-date-cell {
            padding: 8px;
          }
          
          .calendar-container .rbc-date-cell > a {
            font-size: 12px;
            padding: 4px 8px;
            min-width: 28px;
          }
          
          .calendar-container .rbc-event {
            font-size: 11px;
            padding: 4px 8px;
          }
        }

        @media (max-width: 768px) {
          .calendar-container {
            min-height: 500px;
            padding: 12px;
            border-radius: 16px;
          }
          
          .calendar-container .rbc-month-view {
            border-radius: 12px;
          }
          
          .calendar-container .rbc-header {
            padding: 10px 2px;
            font-size: 9px;
            letter-spacing: 0.5px;
          }
          
          .calendar-container .rbc-day-bg {
            min-height: 80px;
          }
          
          .calendar-container .rbc-date-cell {
            padding: 6px;
          }
          
          .calendar-container .rbc-date-cell > a {
            font-size: 11px;
            padding: 3px 6px;
            min-width: 24px;
          }
          
          .calendar-container .rbc-event {
            font-size: 10px;
            padding: 3px 6px;
            border-left-width: 3px;
          }
          
          .calendar-container .rbc-today::before {
            width: 6px;
            height: 6px;
            top: 6px;
            right: 6px;
          }
        }

        @media (max-width: 640px) {
          .calendar-container {
            min-height: 450px;
            padding: 8px;
          }
          
          .calendar-container .rbc-header {
            padding: 8px 1px;
            font-size: 8px;
          }
          
          .calendar-container .rbc-day-bg {
            min-height: 60px;
          }
          
          .calendar-container .rbc-date-cell > a {
            font-size: 10px;
            padding: 2px 4px;
            min-width: 20px;
          }
          
          .calendar-container .rbc-event {
            font-size: 9px;
            padding: 2px 4px;
            border-radius: 4px;
          }
          
          .calendar-container .rbc-now > a {
            transform: scale(1.05);
          }
          
          .calendar-container .rbc-now > a:hover {
            transform: scale(1.08);
          }
        }
      `}</style>
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%', minHeight: 640 }}
        onSelectEvent={(event: any) => onSelectEvent?.(event.resource)}
        onSelectSlot={(slotInfo: any) => onSelectSlot?.(slotInfo)}
        selectable
        view={view}
        onView={onViewChange}
        date={date}
        onNavigate={onNavigate}
        eventPropGetter={eventStyleGetter}
        popup
        views={['month', 'week', 'day', 'agenda']}
        components={{
          toolbar: CustomToolbar
        }}
      />
      </div>
    </div>
  )
}
