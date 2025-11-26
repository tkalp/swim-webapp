import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  Cell,
} from "recharts";
import { useMemo, memo } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

type Datum = { label: string; value: number; color: string };

type Props = {
  data: Datum[];
  title?: string;
  subtitle?: string;
  totalSessions?: number;
};

function AttendanceChart({ data, title, subtitle, totalSessions }: Props) {
  const total = useMemo(
    () => data.reduce((s, d) => s + (d.value || 0), 0),
    [data]
  );
  const pctData = useMemo(
    () =>
      total === 0
        ? data.map((d) => ({ ...d, pct: 0 }))
        : data.map((d) => ({ ...d, pct: Math.round((d.value / total) * 100) })),
    [data, total]
  );

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom duration-500">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {title && (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400">
                <BarChart3 size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">
                {title}
              </h3>
            </div>
          )}
          {subtitle && (
            <p className="text-sm text-slate-400 mb-3">{subtitle}</p>
          )}
          {total > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-100">
                {total}
              </span>
              <span className="text-sm text-slate-400">
                attendance records
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[280px] relative group">
        <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={pctData}
            margin={{ top: 30, right: 20, bottom: 20, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#9CA3AF", fontSize: 13 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
            />
            <YAxis
              tick={{ fill: "#9CA3AF", fontSize: 13 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
              domain={[0, 100]}
              unit="%"
            />
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
              formatter={(v: any) => [`${v}%`, "Attendance"]}
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
            <Bar dataKey="pct" radius={[8, 8, 0, 0]} maxBarSize={80}>
              {pctData.map((e, i) => (
                <Cell
                  key={i}
                  fill={e.color}
                  style={{
                    filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))",
                    transition: "all 0.2s ease",
                  }}
                />
              ))}
              <LabelList
                dataKey="pct"
                position="top"
                formatter={(v: any) => `${v}%`}
                fill="#F8FAFC"
                style={{ fontSize: "13px", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap shrink justify-center gap-3 border-t border-slate-700/50 max-w-full overflow-hidden ">
        {pctData.map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-2 group cursor-pointer hover:scale-105 transition-transform duration-200 min-w-0"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div
              className="w-3 h-3 rounded-full shadow-sm border border-white/20 group-hover:scale-110 transition-transform duration-200 shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-100 transition-colors truncate">
              {d.label}
            </span>
            <span className="text-xs font-bold text-slate-100 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50 group-hover:border-cyan-500/30 transition-colors shrink-0">
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(AttendanceChart);

