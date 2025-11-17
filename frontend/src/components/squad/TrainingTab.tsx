import { useState } from 'react';
import { Calendar, List, CalendarDays } from 'lucide-react';
import WeeklyScheduleView from './WeeklyScheduleView';
import SessionsList from './SessionsList';
import CalendarMonth from './CalenderMonth';
import type { TrainingSubTab } from '../../hooks/useSquadData';
import type { Schedule, Session, CalendarEvent } from '../../features/squads/detailApi';

interface TrainingTabProps {
  squadId: string;
  schedules: Schedule[];
  sessions: Session[];
  events: CalendarEvent[];
  canManageSessions: boolean;
  canManageSchedules: boolean;
  canManageAttendance: boolean;
  onRefresh: () => void;
}

const SUB_TABS: Array<{
  key: TrainingSubTab;
  icon: React.ElementType;
  label: string;
}> = [
    { key: 'sessions', icon: List, label: 'Sessions' },
    { key: 'schedule', icon: Calendar, label: 'Schedule' },
    // { key: 'calendar', icon: CalendarDays, label: 'Calendar' },
];

export function TrainingTab({ squadId, schedules, sessions, events, canManageSessions, canManageSchedules, canManageAttendance, onRefresh }: TrainingTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<TrainingSubTab>('sessions');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab navigation */}
      <div className="shrink-0 bg-background-elevated/80 backdrop-blur-md border-b border-border/60 px-6 py-4 shadow-sm">
        <div className="flex gap-3 flex-wrap">
          {SUB_TABS.map(({ key, icon: Icon, label }) => {
            const isActive = activeSubTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveSubTab(key)}
                className={`
                  relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
                  ${isActive 
                    ? 'bg-linear-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 scale-105' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-primary/10 hover:scale-[1.02] border border-border/40 hover:border-primary/30'
                  }
                  group
                `}
              >
                <Icon size={18} className={`transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
                <span>{label}</span>
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeSubTab === 'schedule' && (
          <WeeklyScheduleView 
            squadId={squadId} 
            schedules={schedules} 
            canManage={canManageSchedules}
            onUpdate={() => {}} 
          />
        )}
        {activeSubTab === 'sessions' && (
          <SessionsList 
            sessions={sessions} 
            squadId={squadId} 
            schedules={schedules}
            canManage={canManageSessions}
            canManageAttendance={canManageAttendance}
            onRefresh={onRefresh}
          />
        )}
        {activeSubTab === 'calendar' && (
          <CalendarMonth 
            events={events}
            canManage={canManageSessions}
          />
        )}
      </div>
    </div>
  );
}
