import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LabelList
} from 'recharts';
import { memo } from 'react';
import { Calendar, Trophy, TrendingUp } from 'lucide-react';

function SessionsPerWeekChart({
  data, bestWeek,
}: {
  data: { week: string; sessions: number }[];
  bestWeek?: { week: string; sessions: number } | null;
}) {

  const distanceTotal = data.reduce((sum, entry) => sum + entry.sessions, 0);
  const total = distanceTotal;

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom duration-500 delay-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center text-accent">
              <Calendar size={20} />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Sessions Per Week</h3>
          </div>
          <p className="text-sm text-text-secondary mb-3">Weekly training frequency</p>
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-accent" />
                <span className="text-2xl font-bold bg-gradient-to-r from-accent via-primary to-primary-dark bg-clip-text text-transparent">{total}</span>
              </div>
              <span className="text-sm text-text-secondary">total sessions</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[260px] relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151"
              opacity={0.3}
              vertical={false}
            />
            <XAxis 
              dataKey="week" 
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
            />
            <YAxis 
              allowDecimals={false} 
              tick={{ fill: '#9CA3AF', fontSize: 13 }}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
            />
            <Tooltip
              cursor={{
                fill: "rgba(139, 92, 246, 0.15)",
                stroke: "rgba(139, 92, 246, 0.4)",
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
              formatter={(v: any) => [`${v}`, "Sessions"]}
              labelFormatter={(l) => `Week ${l}`}
              labelStyle={{
                color: "#8B5CF6",
                marginBottom: "8px",
                fontWeight: 700,
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            />
            <Bar dataKey="sessions" radius={[8, 8, 0, 0]} maxBarSize={60} fill="url(#sessionsGradient)">
              <LabelList 
                dataKey="sessions" 
                position="top" 
                fill="#F8FAFC" 
                style={{ fontSize: "13px", fontWeight: 600 }}
              />
            </Bar>
            <defs>
              <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {bestWeek && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-accent/10 to-primary/10 rounded-xl border border-accent/20">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/30 to-primary/30 flex items-center justify-center">
              <Trophy size={16} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Best week in range</p>
              <p className="text-text-primary font-semibold">
                <span className="text-accent font-bold">{bestWeek.week}</span> with{' '}
                <span className="text-primary font-bold">{bestWeek.sessions}</span> sessions
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SessionsPerWeekChart);
