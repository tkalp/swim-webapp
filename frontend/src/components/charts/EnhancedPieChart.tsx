// components/charts/EnhancedPieChart.tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { useState } from 'react';

export type ChartDataItem = {
  name: string;
  value: number;
  percentage: number;
  color: string;
};

type EnhancedPieChartProps = {
  data: ChartDataItem[];
  total: number;
};

export function EnhancedPieChart({ data, total }: EnhancedPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800/98 backdrop-blur-sm border border-slate-700/50 rounded-lg px-4 py-3 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: data.color }}>{data.name}</div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-6 text-xs">
              <span className="text-slate-400 font-medium">Distance:</span>
              <span className="text-slate-100 font-bold">{data.value.toLocaleString()}m</span>
            </div>
            <div className="flex justify-between gap-6 text-xs">
              <span className="text-slate-400 font-medium">Percentage:</span>
              <span className="text-slate-100 font-bold">{data.percentage}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage, name }: any) => {
    if (percentage < 8) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.65;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <g className="animate-fadeIn">
        <text 
          x={x} 
          y={y - 6} 
          fill="#fff" 
          textAnchor="middle" 
          dominantBaseline="central"
          className="font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-opacity duration-300"
          style={{ animation: 'fadeIn 0.5s ease-in' }}
        >
          {`${percentage}%`}
        </text>
        <text 
          x={x} 
          y={y + 8} 
          fill="rgba(255,255,255,0.7)" 
          textAnchor="middle" 
          dominantBaseline="central"
          className="font-medium text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] transition-opacity duration-300"
          style={{ animation: 'fadeIn 0.5s ease-in 0.1s backwards' }}
        >
          {name.length > 8 ? name.substring(0, 8) + '...' : name}
        </text>
      </g>
    );
  };

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 8) * cos;
    const sy = cy + (outerRadius + 8) * sin;
    const mx = cx + (outerRadius + 20) * cos;
    const my = cy + (outerRadius + 20) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 16;
    const ey = my;

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          stroke="#0f172a"
          strokeWidth={2}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 8}
          outerRadius={outerRadius + 10}
          fill={fill}
          opacity={0.6}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
        <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
        <text 
          x={ex + (cos >= 0 ? 1 : -1) * 8} 
          y={ey - 8} 
          textAnchor={cos >= 0 ? 'start' : 'end'} 
          fill="#e2e8f0"
          className="font-bold text-xs transition-opacity duration-300"
          style={{ animation: 'fadeIn 0.4s ease-out' }}
        >
          {payload.name}
        </text>
        <text 
          x={ex + (cos >= 0 ? 1 : -1) * 8} 
          y={ey + 6} 
          textAnchor={cos >= 0 ? 'start' : 'end'} 
          fill="#94a3b8"
          className="font-medium text-[10px] transition-opacity duration-300"
          style={{ animation: 'fadeIn 0.4s ease-out 0.1s backwards' }}
        >
          {`${payload.value.toLocaleString()}m (${payload.percentage}%)`}
        </text>
      </g>
    );
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 items-center">
      {/* Pie Chart */}
      <div className="flex items-center justify-center relative">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-accent/5 rounded-full blur-xl" />
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <defs>
              {data.map((entry, index) => (
                <linearGradient key={`gradient-${index}`} id={`gradient-chart-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={85}
              innerRadius={45}
              dataKey="value"
              strokeWidth={3}
              stroke="#0f172a"
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#gradient-chart-${index})`}
                  className="transition-all duration-200 cursor-pointer hover:opacity-90"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-[200px]">
        {data.map((item, index) => (
          <div 
            key={item.name} 
            className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-all cursor-pointer group/item border border-slate-700/30 hover:border-slate-600/50"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full shadow-lg group-hover/item:scale-125 transition-transform" 
                style={{ 
                  backgroundColor: item.color,
                  boxShadow: `0 0 0 3px ${item.color}30`
                }}
              />
              <span className="text-sm font-semibold text-slate-100">{item.name}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-300 bg-slate-800/60 px-2 py-1 rounded min-w-[45px] text-center">{item.percentage}%</span>
              <span className="text-sm font-bold text-slate-100 min-w-[65px] text-right">{item.value.toLocaleString()}m</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
