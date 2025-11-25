import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, ComposedChart } from 'recharts';
import { formatTime } from '@/utils/timeUtils';
import { BarChart3, TrendingDown } from 'lucide-react';

type ChartDataPoint = {
  i: number;
  date: string;
  seconds: number;
};

type AttemptsChartProps = {
  data: ChartDataPoint[];
};

// Custom tooltip component for better interaction
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const time = payload[0].value;

        return (
      <div className="bg-linear-to-br from-slate-900/98 to-slate-800/98 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={16} className="text-cyan-400" />
        </div>
        <p className="text-white/90 text-xs mb-2 font-medium">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {formatTime(time)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function AttemptsChart({ data }: AttemptsChartProps) {
  // Adaptive display based on data points
  const showDots = data.length <= 15;
  const shouldRotateLabels = data.length > 10;
  const tickInterval = data.length > 20 ? Math.ceil(data.length / 10) : data.length > 10 ? Math.ceil(data.length / 8) : 0;
  
  // Calculate best time for highlighting
  const bestTime = Math.min(...data.map(d => d.seconds));
  const worstTime = Math.max(...data.map(d => d.seconds));
  
  return (
    <div className="bg-linear-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden shadow-xl">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 via-blue-500/5 to-purple-500/5 opacity-50"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,211,238,0.1),transparent)]"></div>
      
      {/* Accent bars */}
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500"></div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-purple-500 via-blue-500 to-cyan-500"></div>
      
      {/* Title section */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
          <BarChart3 size={24} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Performance Progression
          </h3>
        </div>
      </div>

      {/* Chart */}
      <div className="relative group">
        {/* Hover effect */}
        <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart 
            data={data} 
            margin={{ 
              top: 20, 
              right: 30, 
              left: 20, 
              bottom: shouldRotateLabels ? 60 : 30 
            }}
          >
            {/* Gradient fill under line */}
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#334155" 
              opacity={0.2}
              vertical={false}
            />
            
            <XAxis 
              dataKey="date" 
              tick={{ 
                fill: '#94a3b8', 
                fontSize: 11,
                fontWeight: 500
              }}
              stroke="#475569"
              axisLine={{ stroke: "#475569", strokeWidth: 2 }}
              tickLine={{ stroke: "#475569" }}
              interval={tickInterval}
              angle={shouldRotateLabels ? -45 : 0}
              textAnchor={shouldRotateLabels ? "end" : "middle"}
              height={shouldRotateLabels ? 80 : 50}
            />
            
            <YAxis 
              tick={{ 
                fill: '#94a3b8', 
                fontSize: 12,
                fontWeight: 600
              }}
              stroke="#475569"
              domain={[
                (dataMin: number) => Math.floor(dataMin - 1),
                (dataMax: number) => Math.ceil(dataMax + 1)
              ]}
              axisLine={{ stroke: "#475569", strokeWidth: 2 }}
              tickLine={{ stroke: "#475569" }}
              tickFormatter={(value) => formatTime(value)}
              reversed={true}
              label={{ 
                value: 'Time', 
                angle: -90, 
                position: 'insideLeft',
                style: { 
                  fill: '#94a3b8',
                  fontSize: 12,
                  fontWeight: 600
                }
              }}
            />
            
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: '#22d3ee',
                strokeWidth: 2,
                strokeDasharray: '5 5',
                opacity: 0.5
              }}
            />
            
            {/* Area fill */}
            <Area
              type="monotone"
              dataKey="seconds"
              fill="url(#colorGradient)"
              stroke="none"
            />
            
            {/* Main line */}
            <Line 
              type="monotone" 
              dataKey="seconds" 
              stroke="url(#lineGradient)"
              strokeWidth={4}
              dot={showDots ? (props: any) => {
                const isBest = props.payload.seconds === bestTime;
                const isWorst = props.payload.seconds === worstTime;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isBest ? 8 : 5}
                    fill={isBest ? '#10b981' : isWorst ? '#ef4444' : '#22d3ee'}
                    stroke={isBest ? '#059669' : isWorst ? '#dc2626' : '#0891b2'}
                    strokeWidth={2}
                    className="drop-shadow-lg transition-all duration-200 hover:r-7"
                  />
                );
              } : false}
              activeDot={{ 
                r: 9,
                fill: '#22d3ee',
                stroke: '#0891b2',
                strokeWidth: 3,
                className: 'drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]'
              }}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Legend */}
        {showDots && data.length > 1 && (
          <div className="flex items-center justify-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-600 shadow-lg shadow-green-500/30"></div>
              <span className="text-slate-400">Best Time</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-cyan-600"></div>
              <span className="text-slate-400">Attempt</span>
            </div>
            {data.length > 2 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-600 shadow-lg shadow-red-500/30"></div>
                <span className="text-slate-400">Slowest</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}