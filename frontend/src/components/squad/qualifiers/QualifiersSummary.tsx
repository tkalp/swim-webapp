import { Trophy, Users, Target } from 'lucide-react';

interface QualifiersSummaryProps {
  totalQualified: number;
  totalClose: number;
  totalSwimmers: number;
}

export function QualifiersSummary({ totalQualified, totalClose, totalSwimmers }: QualifiersSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 m-2">
      {/* Qualified Card */}
      <div className="bg-slate-900/40 rounded-lg border border-slate-800/50 p-4 hover:border-emerald-500/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Trophy size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Qualified</p>
            <p className="text-2xl font-semibold text-emerald-400">{totalQualified}</p>
          </div>
        </div>
      </div>

      {/* Close Card */}
      <div className="bg-slate-900/40 rounded-lg border border-slate-800/50 p-4 hover:border-amber-500/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Target size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Close to Qualifying</p>
            <p className="text-2xl font-semibold text-amber-400">{totalClose}</p>
          </div>
        </div>
      </div>

      {/* Total Swimmers Card */}
      <div className="bg-slate-900/40 rounded-lg border border-slate-800/50 p-4 hover:border-cyan-500/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Users size={18} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Swimmers</p>
            <p className="text-2xl font-semibold text-cyan-400">{totalSwimmers}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
