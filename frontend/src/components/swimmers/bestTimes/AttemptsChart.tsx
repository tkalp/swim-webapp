import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatTime } from '../../../utils/timeUtils';
import { BarChart3 } from 'lucide-react';

type ChartDataPoint = {
  i: number;
  date: string;
  seconds: number;
};

type AttemptsChartProps = {
  data: ChartDataPoint[];
};

export default function AttemptsChart({ data }: AttemptsChartProps) {
  // Only show dots if there are 20 or fewer attempts
  const showDots = data.length <= 20;
  
  return (
    <div className="bg-background-elevated border border-border rounded-2xl p-6 relative overflow-hidden">
      {/* Header bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary-dark via-primary to-accent"></div>
      
      {/* Title section */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center text-accent">
          <BarChart3 size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold bg-gradient-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
            Progression Over Time
          </h3>
          {data.length > 20 && (
            <p className="text-xs text-text-tertiary mt-1">
              Showing {data.length} attempts • Dots hidden for clarity
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <ResponsiveContainer width="100%" height={300}>
          <LineChart 
            data={data} 
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151" 
              opacity={0.3}
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              stroke="#475569"
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
            />
            <YAxis 
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              stroke="#475569"
              domain={['dataMin - 2', 'dataMax + 2']}
              axisLine={{ stroke: "#374151" }}
              tickLine={{ stroke: "#374151" }}
              tickFormatter={(value) => formatTime(value)}
              reversed={true}
            />
            <Tooltip
              contentStyle={{ 
                background: 'rgba(30, 41, 59, 0.95)', 
                border: '1px solid #475569', 
                borderRadius: '12px',
                color: '#F8FAFC',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
                padding: '12px 16px'
              }}
              itemStyle={{
                color: '#F8FAFC',
                fontSize: '14px',
                fontWeight: 600,
                padding: '4px 0'
              }}
              labelStyle={{ 
                color: '#22D3EE',
                marginBottom: '8px',
                fontWeight: 700,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              labelFormatter={(label) => `Attempt on ${label}`}
              formatter={(value: any) => [
                `${formatTime(value as number)}`, 
                'Time'
              ]}
            />
            <Line 
              type="monotone" 
              dataKey="seconds" 
              stroke="#3197a7" 
              strokeWidth={3}
              dot={showDots ? { 
                fill: '#22D3EE', 
                strokeWidth: 2, 
                stroke: '#3197a7',
                r: 5
              } : false}
              activeDot={{ 
                r: 7, 
                fill: '#22D3EE',
                stroke: '#3197a7',
                strokeWidth: 2,
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}