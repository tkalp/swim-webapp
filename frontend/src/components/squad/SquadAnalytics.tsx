// components/squad/SquadAnalytics.tsx
// Consolidated view combining Metrics + Attendance analytics
import { useState, lazy, Suspense } from 'react';
import { BarChart3, CalendarCheck } from 'lucide-react';

const SquadMetricsTab = lazy(() => import('@/components/squad/SquadMetrics'));
const SquadAttendanceTab = lazy(() => import('@/components/squad/attendance'));

interface SquadAnalyticsProps {
  squadId: string;
}

type AnalyticsView = 'metrics' | 'attendance';

function ContentSkeleton() {
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

export default function SquadAnalytics({ squadId }: SquadAnalyticsProps) {
  const [view, setView] = useState<AnalyticsView>('metrics');

  return (
    <div className="space-y-4">
      {/* Toggle between Metrics and Attendance */}
      <div className="flex gap-2 px-6 pt-4">
        <button
          onClick={() => setView('metrics')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
            ${view === 'metrics'
              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
              : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }
          `}
        >
          <BarChart3 size={16} />
          Metrics
        </button>
        <button
          onClick={() => setView('attendance')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
            ${view === 'attendance'
              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
              : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }
          `}
        >
          <CalendarCheck size={16} />
          Attendance
        </button>
      </div>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        {view === 'metrics' && <SquadMetricsTab squadId={squadId} />}
        {view === 'attendance' && <SquadAttendanceTab squadId={squadId} />}
      </Suspense>
    </div>
  );
}
