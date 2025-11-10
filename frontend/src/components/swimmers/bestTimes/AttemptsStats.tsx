import { formatTime } from '../../../features/swimmers/bestTimesApi';
import { TrendingUp, Clock, Target } from 'lucide-react';

type AttemptsStatsProps = {
  first: number;
  last: number;
  best: number;
  totalAttempts: number;
  delta: number;
  improvedPct: number;
};

export default function AttemptsStats({
  first,
  last,
  best,
  totalAttempts,
  delta,
  improvedPct
}: AttemptsStatsProps) {
  return (
    <section className="flex flex-col sm:flex-row gap-6 mb-8">
      {/* First to Last */}
      <div className="flex-1 bg-background-elevated border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-border-light hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary-dark via-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary">
            <TrendingUp size={20} />
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">First → Last</div>
        </div>
        <div className="text-xl font-bold text-text-primary mb-2">
          <span className="text-primary">{formatTime(first)}</span>
          <span className="text-text-muted mx-2">→</span>
          <span className="text-accent">{formatTime(last)}</span>
        </div>
        <div className={`text-sm font-medium ${delta < 0 ? 'text-success' : delta > 0 ? 'text-danger' : 'text-text-muted'}`}>
          {delta < 0 ? 'Improved' : delta > 0 ? 'Slower' : 'No change'} {Math.abs(delta).toFixed(2)}s
        </div>
      </div>
      
      {/* Best Time */}
      <div className="flex-1 bg-background-elevated border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-border-light hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary-dark via-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center text-accent">
            <Target size={20} />
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Best Time</div>
        </div>
        <div className="text-xl font-bold bg-gradient-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent mb-2">
          {formatTime(best)}
        </div>
        <div className="text-sm text-text-muted font-medium">
          Across {totalAttempts} attempt{totalAttempts !== 1 ? 's' : ''}
        </div>
      </div>
      
      {/* Improvement */}
      <div className="flex-1 bg-background-elevated border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-border-light hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary-dark via-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            improvedPct >= 0 
              ? 'bg-gradient-to-br from-success/20 to-success/10 text-success' 
              : 'bg-gradient-to-br from-danger/20 to-danger/10 text-danger'
          }`}>
            <Clock size={20} />
          </div>
          <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Improvement</div>
        </div>
        <div 
          className={`text-xl font-bold mb-2 ${improvedPct >= 0 ? 'text-success' : 'text-danger'}`}
        >
          {improvedPct >= 0 ? '+' : ''}{improvedPct}%
        </div>
        <div className="text-sm text-text-muted font-medium">First vs Last</div>
      </div>
    </section>
  );
}