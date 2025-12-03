import { Check, AlertTriangle, X, Minus } from 'lucide-react';

type QualificationStatus = 'qualified' | 'very-close' | 'close' | 'far' | 'very-far' | 'no-time';

interface QualificationCellProps {
  swimmerBestTime: number | null;
  standardTime: number;
  percentageGap: number | null;
}

export function QualificationCell({ swimmerBestTime, standardTime, percentageGap }: QualificationCellProps) {
  if (swimmerBestTime === null || percentageGap === null) {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="text-slate-500 text-sm">—</span>
      </div>
    );
  }

  // Determine status based on percentage gap
  // Negative gap means they're faster than the standard (qualified)
  const getStatus = (): QualificationStatus => {
    if (percentageGap < 0) return 'qualified';
    if (percentageGap < 2) return 'very-close';
    if (percentageGap < 5) return 'close';
    if (percentageGap < 10) return 'far';
    return 'very-far';
  };

  const status = getStatus();

  // Color scheme matching StandardsCell
  const statusConfig = {
    qualified: {
      icon: Check,
      bgGradient: 'bg-linear-to-br from-emerald-500/20 to-green-500/20',
      border: 'border-emerald-500/40',
      text: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      label: 'Qualified',
    },
    'very-close': {
      icon: AlertTriangle,
      bgGradient: 'bg-linear-to-br from-amber-500/20 to-yellow-500/20',
      border: 'border-amber-500/40',
      text: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
      label: 'Very Close',
    },
    close: {
      icon: AlertTriangle,
      bgGradient: 'bg-linear-to-br from-orange-500/20 to-amber-500/20',
      border: 'border-orange-500/40',
      text: 'text-orange-400',
      iconBg: 'bg-orange-500/20',
      label: 'Close',
    },
    far: {
      icon: X,
      bgGradient: 'bg-linear-to-br from-red-500/20 to-orange-500/20',
      border: 'border-red-500/40',
      text: 'text-red-400',
      iconBg: 'bg-red-500/20',
      label: 'Far',
    },
    'very-far': {
      icon: X,
      bgGradient: 'bg-linear-to-br from-rose-500/20 to-red-500/20',
      border: 'border-rose-500/40',
      text: 'text-rose-400',
      iconBg: 'bg-rose-500/20',
      label: 'Very Far',
    },
    'no-time': {
      icon: Minus,
      bgGradient: 'bg-slate-800/50',
      border: 'border-slate-700/50',
      text: 'text-slate-500',
      iconBg: 'bg-slate-700/50',
      label: 'No Time',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const formatPercentage = (pct: number) => {
    if (pct < 0) return `${Math.abs(pct).toFixed(1)}%`;
    return `+${pct.toFixed(1)}%`;
  };

  return (
    <div className="flex items-center justify-center py-2">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${config.border} ${config.bgGradient} backdrop-blur-sm`}
        title={`${config.label}: ${formatPercentage(percentageGap)} from standard`}
      >
        <div className={`p-0.5 rounded ${config.iconBg}`}>
          <Icon size={12} className={config.text} strokeWidth={2.5} />
        </div>
        <span className={`text-xs font-semibold ${config.text}`}>
          {formatPercentage(percentageGap)}
        </span>
      </div>
    </div>
  );
}
