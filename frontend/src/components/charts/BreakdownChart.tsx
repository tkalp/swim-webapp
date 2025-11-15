// components/charts/BreakdownChart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useMemo } from "react";
import { Activity } from "lucide-react";

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
        <div className="flex-1 min-h-[280px] relative group">
          <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-accent/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={50}
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))",
                    }}
                  />
                ))}
              </Pie>
              <Tooltip
                cursor={{
                  fill: "rgba(49, 151, 167, 0.15)",
                  stroke: "rgba(49, 151, 167, 0.4)",
                  strokeWidth: 2,
                  radius: 8,
                }}
                contentStyle={{
                  background: "rgba(30, 41, 59, 0.95)",
                  border: "1px solid #475569",
                  borderRadius: "12px",
                  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
                  backdropFilter: "blur(10px)",
                  color: "#F8FAFC",
                  padding: "12px 16px",
                }}
                itemStyle={{
                  color: "#F8FAFC",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "4px 0",
                }}
                formatter={(value: any, name: string) => [
                  `${Number(value).toLocaleString()}m`,
                  name
                ]}
                labelFormatter={(l) => l}
                labelStyle={{
                  color: "#22D3EE",
                  marginBottom: "8px",
                  fontWeight: 700,
                  fontSize: "13px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-muted">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background-tertiary flex items-center justify-center">
              {icon}
            </div>
            <p className="text-sm">No data available for this time period</p>
          </div>
        </div>
      )}

      {/* Legend */}
      {hasData && (
        <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border/50">
          {data.map((d, i) => {
            const percentage = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <div
                key={i}
                className="flex items-center gap-3 group cursor-pointer hover:scale-105 transition-transform duration-200"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div
                  className="w-4 h-4 rounded-full shadow-sm border border-white/20 group-hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                  {d.name}
                </span>
                <span className="text-xs text-text-muted">
                  {percentage.toFixed(1)}%
                </span>
                <span className="text-sm font-bold text-text-primary bg-background-tertiary px-2.5 py-1 rounded-lg border border-border/50 group-hover:border-primary/30 transition-colors">
                  {d.value.toLocaleString()}m
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
