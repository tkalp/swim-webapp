// components/workout/WorkoutBreakdownCharts.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Activity, Droplets } from 'lucide-react';

type EstimateData = {
  difficulty: string;
  totalMinutes: number;
  totalDistance: number;
  intensityScore: number;
  strokeBreakdown: {
    choice: number;
    butterfly: number;
    freestyle: number;
    backstroke: number;
    breaststroke: number;
    individualMedley: number;
  };
  activityBreakdown: {
    kick: number;
    pull: number;
    swim: number;
    drill: number;
  };
};

type WorkoutBreakdownChartsProps = {
  estimate: EstimateData;
};

const STROKE_COLORS: Record<string, string> = {
  freestyle: '#22D3EE',
  backstroke: '#8B5CF6', 
  breaststroke: '#10B981',
  butterfly: '#F59E0B',
  individualMedley: '#EF4444',
  im: '#EF4444', // Handle both IM formats
  choice: '#6B7280'
};

const STROKE_LABELS: Record<string, string> = {
  freestyle: 'Freestyle',
  backstroke: 'Backstroke',
  breaststroke: 'Breaststroke', 
  butterfly: 'Butterfly',
  individualMedley: 'IM',
  im: 'IM', // Handle both IM formats
  choice: 'Choice'
};

const ACTIVITY_COLORS: Record<string, string> = {
  swim: '#22D3EE',
  kick: '#EF4444',
  pull: '#10B981',
  drill: '#F59E0B'
};

export default function WorkoutBreakdownCharts({ estimate }: WorkoutBreakdownChartsProps) {
  // Process stroke breakdown - handle both 'individualMedley' and 'im' keys
  const strokeBreakdown: any = { ...estimate.strokeBreakdown };
  
  // Merge any 'im' data into 'individualMedley' for consistent processing
  if ('im' in strokeBreakdown && typeof strokeBreakdown.im === 'number') {
    strokeBreakdown.individualMedley = (strokeBreakdown.individualMedley || 0) + strokeBreakdown.im;
    delete strokeBreakdown.im;
  }
  
  const strokeTotal = Object.values(strokeBreakdown).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
  const strokeData = Object.entries(strokeBreakdown)
    .filter(([_, value]) => typeof value === 'number' && value > 0)
    .map(([stroke, value]) => ({
      name: STROKE_LABELS[stroke] || stroke.charAt(0).toUpperCase() + stroke.slice(1).replace(/([A-Z])/g, ' $1'),
      value: value as number,
      percentage: strokeTotal > 0 ? Math.round(((value as number) / strokeTotal) * 100) : 0,
      color: STROKE_COLORS[stroke] || '#6B7280'
    }))
    .sort((a, b) => b.value - a.value);

  // Process activity breakdown
  const activityTotal = Object.values(estimate.activityBreakdown).reduce((sum, val) => sum + val, 0);
  const activityData = Object.entries(estimate.activityBreakdown)
    .filter(([_, value]) => value > 0)
    .map(([activity, value]) => ({
      name: activity.charAt(0).toUpperCase() + activity.slice(1),
      value: value,
      percentage: activityTotal > 0 ? Math.round((value / activityTotal) * 100) : 0,
      color: ACTIVITY_COLORS[activity] || '#6B7280'
    }))
    .sort((a, b) => b.value - a.value);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800/98 backdrop-blur-sm border border-slate-700/50 rounded-lg px-4 py-3 shadow-xl">
          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">{data.name}</div>
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

  if (strokeData.length === 0 && activityData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
        {/* Stroke Breakdown */}
        {strokeData.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6 transition-all hover:border-slate-700/50 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-cyan-500/50 to-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-11 h-11 rounded-lg bg-linear-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center text-primary shrink-0">
                <Droplets size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 mb-1">Distance by Stroke</h3>
                <p className="text-sm text-slate-400 font-medium">{strokeTotal.toLocaleString()}m total</p>
              </div>
            </div>
            
            <div className="my-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={strokeData}
                  margin={{ top: 15, right: 10, bottom: 5, left: 0 }}
                  barGap={8}
                >
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(49, 151, 167, 0.1)', radius: 8 }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  >
                    {strokeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList 
                      dataKey="percentage" 
                      position="top" 
                      formatter={(value: any) => `${value}%`}
                      fill="#E5E7EB"
                      style={{ fontSize: '11px', fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-2">
              {strokeData.map((item) => (
                <div key={item.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800/60 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full shadow-lg group-hover:scale-110 transition-transform" 
                      style={{ 
                        backgroundColor: item.color,
                        boxShadow: `0 0 0 3px ${item.color}30`
                      }}
                    />
                    <span className="text-sm font-medium text-slate-100">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-400 bg-slate-800/50 px-2 py-1 rounded">{item.percentage}%</span>
                    <span className="text-sm font-bold text-slate-100 min-w-[60px] text-right">{item.value.toLocaleString()}m</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Breakdown */}
        {activityData.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6 transition-all hover:border-slate-700/50 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-cyan-500/50 to-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-11 h-11 rounded-lg bg-linear-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-success shrink-0">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 mb-1">Distance by Activity</h3>
                <p className="text-sm text-slate-400 font-medium">{activityTotal.toLocaleString()}m total</p>
              </div>
            </div>
            
            <div className="my-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart 
                  data={activityData}
                  margin={{ top: 15, right: 10, bottom: 5, left: 0 }}
                  barGap={8}
                >
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    axisLine={{ stroke: '#374151', strokeWidth: 1 }}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(49, 151, 167, 0.1)', radius: 8 }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  >
                    {activityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList 
                      dataKey="percentage" 
                      position="top" 
                      formatter={(value: any) => `${value}%`}
                      fill="#E5E7EB"
                      style={{ fontSize: '11px', fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-2">
              {activityData.map((item) => (
                <div key={item.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800/60 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full shadow-lg group-hover:scale-110 transition-transform" 
                      style={{ 
                        backgroundColor: item.color,
                        boxShadow: `0 0 0 3px ${item.color}30`
                      }}
                    />
                    <span className="text-sm font-medium text-slate-100">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-400 bg-slate-800/50 px-2 py-1 rounded">{item.percentage}%</span>
                    <span className="text-sm font-bold text-slate-100 min-w-[60px] text-right">{item.value.toLocaleString()}m</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
