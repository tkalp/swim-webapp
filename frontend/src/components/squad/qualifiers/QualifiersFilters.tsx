type StrokeType = 'all' | 'free' | 'back' | 'breast' | 'fly' | 'im';
type StatusType = 'all' | 'qualified' | 'close' | 'not-qualified';

const STROKE_LABELS: Record<string, string> = {
  all: 'All',
  free: 'Free',
  back: 'Back',
  breast: 'Breast',
  fly: 'Fly',
  im: 'IM',
};

interface QualifiersFiltersProps {
  selectedStroke: string;
  onStrokeChange: (stroke: string) => void;
  selectedDistance: number | null;
  onDistanceChange: (distance: number | null) => void;
  availableDistances: number[];
  statusFilter: StatusType;
  onStatusChange: (status: StatusType) => void;
  poolType: 'SCM' | 'LCM';
  onPoolTypeChange: (poolType: 'SCM' | 'LCM') => void;
}

export function QualifiersFilters({
  selectedStroke,
  onStrokeChange,
  selectedDistance,
  onDistanceChange,
  availableDistances,
  statusFilter,
  onStatusChange,
  poolType,
  onPoolTypeChange,
}: QualifiersFiltersProps) {
  const strokes: StrokeType[] = ['all', 'free', 'back', 'breast', 'fly', 'im'];
  const statuses: StatusType[] = ['all', 'qualified', 'close', 'not-qualified'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
      {/* Pool Type Filter */}
      <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
        <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Pool Type
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onPoolTypeChange('SCM')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                poolType === 'SCM'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              SCM (25m)
            </button>
            <button
              onClick={() => onPoolTypeChange('LCM')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                poolType === 'LCM'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              LCM (50m)
            </button>
          </div>
        </div>
      </div>

      {/* Stroke Filter */}
      <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
        <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Stroke
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {strokes.map(stroke => (
              <button
                key={stroke}
                onClick={() => onStrokeChange(stroke)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  selectedStroke === stroke
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
                }`}
              >
                {STROKE_LABELS[stroke]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Distance Filter */}
      <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
        <div className="absolute inset-0 bg-linear-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Distance
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onDistanceChange(null)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                selectedDistance === null
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              All
            </button>
            {availableDistances.slice(0, 5).map(dist => (
              <button
                key={dist}
                onClick={() => onDistanceChange(dist)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  selectedDistance === dist
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
                }`}
              >
                {dist}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
        <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Status
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {statuses.map(status => (
              <button
                key={status}
                onClick={() => onStatusChange(status)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  statusFilter === status
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-transparent'
                }`}
              >
                {status === 'all'
                  ? 'All'
                  : status === 'not-qualified'
                  ? 'Not Qual'
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
