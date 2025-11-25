// components/squad/SquadPerformanceRankings.tsx
// Consolidated view combining Performance + Rankings
import { useState, lazy, Suspense } from 'react';
import { TrendingUp, Trophy } from 'lucide-react';

const SquadPerformanceTab = lazy(() => import('@/components/squad/performance').then(m => ({ default: m.SquadPerformanceTab })));
const SquadRankings = lazy(() => import('@/components/squad/SquadRankings'));

interface SquadPerformanceRankingsProps {
  squadId: string;
}

type PerformanceView = 'performance' | 'rankings';

function ContentSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-slate-800/50 rounded w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-48 bg-slate-800/50 rounded-xl" />
        <div className="h-48 bg-slate-800/50 rounded-xl" />
      </div>
      <div className="h-96 bg-slate-800/50 rounded-xl" />
    </div>
  );
}

export default function SquadPerformanceRankings({ squadId }: SquadPerformanceRankingsProps) {
  const [view, setView] = useState<PerformanceView>('performance');

  return (
    <div className="space-y-4">
      {/* Toggle between Performance and Rankings */}
      <div className="flex gap-2 px-6 pt-4">
        <button
          onClick={() => setView('performance')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
            ${view === 'performance'
              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
              : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }
          `}
        >
          <TrendingUp size={16} />
          Performance
        </button>
        <button
          onClick={() => setView('rankings')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
            ${view === 'rankings'
              ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
              : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }
          `}
        >
          <Trophy size={16} />
          Rankings
        </button>
      </div>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        {view === 'performance' && <SquadPerformanceTab squadId={squadId} />}
        {view === 'rankings' && <SquadRankings squadId={squadId} />}
      </Suspense>
    </div>
  );
}
