// components/charts/BreakdownChart.tsx
import { useMemo } from "react";
import { Activity } from "lucide-react";
import { EnhancedPieChart } from './EnhancedPieChart';

type BreakdownData = {
  name: string;
  value: number;
  color: string;
};

type Props = {
  data: BreakdownData[];
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

export default function BreakdownChart({
  data,
  title,
  subtitle,
  icon = <Activity size={20} />,
}: Props) {
  const total = useMemo(
    () => data.reduce((s, d) => s + (d.value || 0), 0),
    [data]
  );

  const hasData = data.length > 0 && total > 0;

  const dataWithPercentage = useMemo(() => {
    return data.map(d => ({
      ...d,
      percentage: total > 0 ? Math.round((d.value / total) * 100) : 0
    }));
  }, [data, total]);

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom duration-500">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-sm text-text-secondary mb-3">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Chart */}
      {hasData ? (
        <EnhancedPieChart data={dataWithPercentage} total={total} />
      ) : (
        <div className="flex-1 flex items-center justify-center min-h-60">
          <div className="text-center text-text-muted">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background-tertiary flex items-center justify-center">
              {icon}
            </div>
            <p className="text-sm">No data available for this time period</p>
          </div>
        </div>
      )}
    </div>
  );
}

