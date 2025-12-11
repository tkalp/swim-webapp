import { useState, lazy, Suspense, useEffect } from 'react';
import { BarChart3, Trophy, TrendingUp, CalendarCheck, Lock, Target } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// Lazy load sub-tab components
const SquadMetricsTab = lazy(() => import('@/components/squad/SquadMetrics'));
const SquadRankings = lazy(() => import('@/components/squad/SquadRankings'));
const SquadPerformanceTab = lazy(() => import('@/components/squad/performance').then(m => ({ default: m.SquadPerformanceTab })));
const SquadAttendanceTab = lazy(() => import('@/components/squad/attendance'));
const SquadQualifiers = lazy(() => import('@/components/squad/qualifiers'));

// Loading skeleton component
function TabSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-slate-800/50 rounded w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-slate-800/50 rounded-xl" />
        <div className="h-32 bg-slate-800/50 rounded-xl" />
        <div className="h-32 bg-slate-800/50 rounded-xl" />
      </div>
      <div className="h-64 bg-slate-800/50 rounded-xl" />
    </div>
  );
}

interface OverviewTabProps {
  squadId: string;
}

type OverviewSubTab = 'metrics' | 'rankings' | 'qualifiers' | 'performance' | 'attendance';

export function OverviewTab({ squadId }: OverviewTabProps) {
  const { hasQualifiers } = useFeatureFlags();
  const [activeSubTab, setActiveSubTab] = useState<OverviewSubTab>('metrics');
  const { hasPermission, loading } = usePermissions(squadId);
  const [tabsWithData, setTabsWithData] = useState<Set<OverviewSubTab>>(new Set(['metrics', 'rankings', 'performance', 'attendance']));
  const [checkingData, setCheckingData] = useState(true);

  // Build sub-tabs array based on feature flags
  const SUB_TABS: Array<{
    key: OverviewSubTab;
    icon: React.ElementType;
    label: string;
  }> = [
    { key: 'metrics', icon: BarChart3, label: 'Metrics' },
    { key: 'rankings', icon: Trophy, label: 'Rankings' },
    ...(hasQualifiers ? [{ key: 'qualifiers' as OverviewSubTab, icon: Target, label: 'Qualifiers' }] : []),
    { key: 'performance', icon: TrendingUp, label: 'Performance' },
    { key: 'attendance', icon: CalendarCheck, label: 'Attendance' },
  ];

  // Setup available tabs based on feature flags
  useEffect(() => {
    const availableTabs = new Set<OverviewSubTab>();
    
    // Always show core tabs - they handle their own empty states
    availableTabs.add('metrics');
    availableTabs.add('rankings');
    availableTabs.add('performance');
    availableTabs.add('attendance'); // Always show, let component handle empty state
    
    // Add qualifiers if feature is enabled
    if (hasQualifiers) {
      availableTabs.add('qualifiers');
    }
    
    setTabsWithData(availableTabs);
    setCheckingData(false);
  }, [hasQualifiers]);

  // Filter visible tabs
  const visibleTabs = SUB_TABS.filter(tab => tabsWithData.has(tab.key));

  return (
    <div className="flex flex-col h-full bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Compact Sub-tab navigation */}
      <div className="shrink-0 px-6 py-3 border-b border-cyan-500/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="flex gap-2 flex-wrap">
          {visibleTabs.map(({ key, icon: Icon, label }) => {
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
        {!hasPermission('can_view_analytics') ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-4">
            <div className="relative group">
              {/* Animated glow effect */}
              <div className="absolute inset-0 bg-linear-to-r from-orange-500/20 to-red-500/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500 animate-pulse" />
              
              <div className="relative w-24 h-24 rounded-3xl bg-linear-to-br from-orange-500/20 to-red-500/20 border-2 border-orange-500/30 flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/20 group-hover:scale-110 transition-transform duration-300">
                <Lock size={48} className="text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold bg-linear-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-3">
              Analytics Access Required
            </h3>
            <p className="text-slate-400 text-center max-w-md text-sm leading-relaxed">
              You don't have permission to view analytics for this squad. Contact the squad owner or an admin to request access.
            </p>
            
            {/* Decorative elements */}
            <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-red-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
        ) : (
          <Suspense fallback={<TabSkeleton />}>
            {activeSubTab === 'metrics' && <SquadMetricsTab squadId={squadId} />}
            {activeSubTab === 'rankings' && <SquadRankings squadId={squadId} />}
            {activeSubTab === 'qualifiers' && <SquadQualifiers squadId={squadId} />}
            {activeSubTab === 'performance' && <SquadPerformanceTab squadId={squadId} />}
            {activeSubTab === 'attendance' && <SquadAttendanceTab squadId={squadId} />}
          </Suspense>
        )}
      </div>
    </div>
  );
}
