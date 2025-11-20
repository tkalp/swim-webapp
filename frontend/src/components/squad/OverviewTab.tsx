import { useState } from 'react';
import { BarChart3, Trophy, TrendingUp, Lock, CalendarCheck } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import SquadMetricsTab from '@/components/squad/SquadMetrics';
import SquadRankings from '@/components/squad/SquadRankings';
import { SquadPerformanceTab } from '@/components/squad/performance';
import SquadAttendanceTab from '@/components/squad/attendance';

interface OverviewTabProps {
  squadId: string;
}

type OverviewSubTab = 'metrics' | 'rankings' | 'performance' | 'attendance';

const SUB_TABS: Array<{
  key: OverviewSubTab;
  icon: React.ElementType;
  label: string;
}> = [
  { key: 'metrics', icon: BarChart3, label: 'Metrics' },
  { key: 'rankings', icon: Trophy, label: 'Rankings' },
  { key: 'performance', icon: TrendingUp, label: 'Performance' },
  { key: 'attendance', icon: CalendarCheck, label: 'Attendance' },
];

export function OverviewTab({ squadId }: OverviewTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<OverviewSubTab>('metrics');
  const { hasPermission, loading } = usePermissions(squadId);

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
        {!hasPermission('can_view_analytics') ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-4">
            <div className="w-20 h-20 rounded-2xl bg-warning/10 flex items-center justify-center text-warning mb-6">
              <Lock size={40} />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Analytics Access Required</h3>
            <p className="text-text-secondary text-center max-w-md">
              You don't have permission to view analytics for this squad. Contact the squad owner or an admin to request access.
            </p>
          </div>
        ) : (
          <>
            {activeSubTab === 'metrics' && <SquadMetricsTab squadId={squadId} />}
            {activeSubTab === 'rankings' && <SquadRankings squadId={squadId} />}
            {activeSubTab === 'performance' && <SquadPerformanceTab squadId={squadId} />}
            {activeSubTab === 'attendance' && <SquadAttendanceTab squadId={squadId} />}
          </>
        )}
      </div>
    </div>
  );
}
