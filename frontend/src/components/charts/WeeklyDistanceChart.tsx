import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Line,
} from "recharts";
import { Calendar } from "lucide-react";

export default function DistancePerWeekChart({
  title,
  subtitle,
  dist,
}: {
  title: string;
  subtitle: string;
  dist: { week: string; meters: number }[];
}) {
  // Use memo for total calculation
  const total = dist.reduce((sum, entry) => sum + entry.meters, 0);
  const avgWeeklyDistance =
    dist.length > 0 ? Math.round(total / dist.length) : 0;

  // Additional stats for footer
  const peakWeek = dist.length > 0 ? 
    dist.reduce((max, week) => week.meters > max.meters ? week : max, dist[0]) : null;
  const minWeek = dist.length > 0 ? 
    dist.reduce((min, week) => week.meters < min.meters ? week : min, dist[0]) : null;
  
  // Calculate trend (simple comparison of first half vs second half)
  const midPoint = Math.floor(dist.length / 2);
  const firstHalfAvg = dist.length > 1 ? 
    dist.slice(0, midPoint).reduce((sum, w) => sum + w.meters, 0) / midPoint : 0;
  const secondHalfAvg = dist.length > 1 ? 
    dist.slice(midPoint).reduce((sum, w) => sum + w.meters, 0) / (dist.length - midPoint) : 0;
  const trendDirection = secondHalfAvg > firstHalfAvg ? 'up' : secondHalfAvg < firstHalfAvg ? 'down' : 'stable';

 
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-4">
        {subtitle && (
          <p className="text-sm text-text-secondary mb-1">{subtitle}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-accent">{avgWeeklyDistance.toLocaleString()}</span>
          <span className="text-sm text-text-secondary">avg/week</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[280px]">
        {dist.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={dist}
              margin={{ top: 20, right: 20, bottom: 10, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                opacity={0.3}
              />
              <XAxis
                dataKey="week"
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                stroke="#374151"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                stroke="#374151"
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
                formatter={(v: any) => [`${v.toLocaleString()} m`, "Distance"]}
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
              <Bar
                dataKey="meters"
                radius={[8, 8, 0, 0]}
                fill="url(#distGradient)"
              />
              <Line
                dot={false}
                strokeWidth={2}
                strokeLinecap="round"
                type="monotone"
                dataKey="meters"
                stroke="#05f725ff"
                yAxisId="right"
                legendType="rect"
                name="Amount Spent"
                tooltipType="none"
              />
              <defs>
                <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#54d4e7ff" />
                  <stop offset="100%" stopColor="#a13cffff" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-text-secondary">
            <div className="text-center">
              <Calendar
                size={48}
                className="opacity-50 mb-4 mx-auto text-text-secondary"
              />
              <p className="text-sm">No distance data for this period</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {dist.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            {/* Peak Week */}
            {peakWeek && (
              <div className="flex items-center gap-2 group">
                <div className="w-2 h-2 bg-accent rounded-full"></div>
                <span className="text-text-secondary">Peak:</span>
                <span className="text-text-primary font-medium">
                  {peakWeek.meters.toLocaleString()}m
                </span>
                <span className="text-text-muted">({peakWeek.week})</span>
              </div>
            )}

            {/* Low Week */}
            {minWeek && peakWeek && minWeek.meters !== peakWeek.meters && (
              <div className="flex items-center gap-2 group">
                <div className="w-2 h-2 bg-text-muted rounded-full"></div>
                <span className="text-text-secondary">Low:</span>
                <span className="text-text-primary font-medium">
                  {minWeek.meters.toLocaleString()}m
                </span>
                <span className="text-text-muted">({minWeek.week})</span>
              </div>
            )}

            {/* Trend */}
            {dist.length > 2 && (
              <div className="flex items-center gap-2 group">
                <div className={`w-2 h-2 rounded-full ${
                  trendDirection === 'up' ? 'bg-success' : 
                  trendDirection === 'down' ? 'bg-warning' : 'bg-primary'
                }`}></div>
                <span className="text-text-secondary">Trend:</span>
                <span className={`font-medium ${
                  trendDirection === 'up' ? 'text-success' : 
                  trendDirection === 'down' ? 'text-warning' : 'text-text-primary'
                }`}>
                  {trendDirection === 'up' ? '↗ Increasing' : 
                   trendDirection === 'down' ? '↘ Decreasing' : '→ Stable'}
                </span>
              </div>
            )}

            {/* Weekly Range */}
            {peakWeek && minWeek && peakWeek.meters !== minWeek.meters && (
              <div className="flex items-center gap-2 group">
                <div className="w-2 h-2 bg-accent-purple rounded-full"></div>
                <span className="text-text-secondary">Range:</span>
                <span className="text-text-primary font-medium">
                  {(peakWeek.meters - minWeek.meters).toLocaleString()}m
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
