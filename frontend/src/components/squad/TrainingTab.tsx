import { useState, lazy, Suspense } from 'react';
import { Calendar, List, CalendarDays } from 'lucide-react';
import type { TrainingSubTab } from '@/hooks/useSquadData';

// Lazy load sub-tab components
const WeeklyScheduleView = lazy(() => import('@/components/squad/WeeklyScheduleView'));
const SessionsList = lazy(() => import('@/components/squad/SessionsList'));
const CalendarMonth = lazy(() => import('@/components/squad/CalenderMonth'));

// Loading skeleton component
function TabSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-slate-800/50 rounded w-1/4" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}


interface TrainingTabProps {
  squadId: string;
  schedules: any[];
  sessions: any[];
  events: any[];
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
    <div className="flex flex-col h-full bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Compact Sub-tab navigation */}
      <div className="shrink-0 px-6 py-3 border-b border-cyan-500/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="flex gap-2 flex-wrap">
          {SUB_TABS.map(({ key, icon: Icon, label }) => {
            const isActive = activeSubTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveSubTab(key)}
                className={`
                  relative group overflow-hidden rounded-lg transition-all duration-200 px-3 py-2
                  ${isActive 
                    ? 'bg-linear-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30 scale-105' 
                    : 'bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 hover:scale-[1.02]'
                  }
                `}
              >
                {/* Content */}
                <div className="relative z-10 flex items-center gap-2">
                  <Icon 
                    size={16} 
                    className={`
                      transition-all duration-200
                      ${isActive 
                        ? 'text-white' 
                        : 'text-slate-400 group-hover:text-cyan-400'
                      }
                    `}
                    strokeWidth={2.5}
                  />
                  <span className={`
                    font-semibold text-xs transition-colors duration-200
                    ${isActive 
                      ? 'text-white' 
                      : 'text-slate-400 group-hover:text-slate-200'
                    }
                  `}>
                    {label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-y-auto bg-linear-to-b from-transparent via-slate-900/30 to-transparent">
        <Suspense fallback={<TabSkeleton />}>
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
        </Suspense>
      </div>
    </div>
  );
}
