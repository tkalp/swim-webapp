// components/workout/WorkoutBreakdownCharts.tsx
import { Activity, Droplets } from 'lucide-react';
import { EnhancedPieChart } from '../charts/EnhancedPieChart';
import { Sector } from 'recharts';

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
  freestyle: '#3B82F6', // Brilliant blue
  backstroke: '#A855F7', // Vivid purple 
  breaststroke: '#10B981', // Emerald green
  butterfly: '#F97316', // Bright orange
  individualMedley: '#EC4899', // Hot pink
  im: '#EC4899', // Handle both IM formats
  choice: '#FBBF24', // Golden yellow
  mixed: '#8B5CF6' // Purple-violet
};

const STROKE_LABELS: Record<string, string> = {
  freestyle: 'Free',
  backstroke: 'Back',
  breaststroke: 'Breast', 
  butterfly: 'Fly',
  individualMedley: 'IM',
  im: 'IM', // Handle both IM formats
  choice: 'Choice'
};

const ACTIVITY_COLORS: Record<string, string> = {
  swim: '#3B82F6', // Brilliant blue
  kick: '#F97316', // Bright orange
  pull: '#10B981', // Emerald green
  drill: '#FBBF24', // Golden yellow
  mixed: '#8B5CF6' // Purple-violet
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
    if (percentage < 8) return null; // Don't show label for small slices
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
    const textAnchor = cos >= 0 ? 'start' : 'end';

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
          textAnchor={textAnchor} 
          fill="#e2e8f0"
          className="font-bold text-xs transition-opacity duration-300"
          style={{ animation: 'fadeIn 0.4s ease-out' }}
        >
          {payload.name}
        </text>
        <text 
          x={ex + (cos >= 0 ? 1 : -1) * 8} 
          y={ey + 6} 
          textAnchor={textAnchor} 
          fill="#94a3b8"
          className="font-medium text-[10px] transition-opacity duration-300"
          style={{ animation: 'fadeIn 0.4s ease-out 0.1s backwards' }}
        >
          {`${payload.value.toLocaleString()}m (${payload.percentage}%)`}
        </text>
      </g>
    );
  };

  if (strokeData.length === 0 && activityData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
        {/* Stroke Breakdown */}
        {strokeData.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-5 transition-all hover:border-slate-700/50 hover:shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-cyan-500/50 to-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center text-primary shrink-0">
                <Droplets size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Stroke Distribution</h3>
                <p className="text-xs text-slate-400 font-medium">{strokeTotal.toLocaleString()}m total</p>
              </div>
            </div>
            
            <EnhancedPieChart data={strokeData} total={strokeTotal} />
          </div>
        )}

        {/* Activity Breakdown */}
        {activityData.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-5 transition-all hover:border-slate-700/50 hover:shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-cyan-500/50 to-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-success shrink-0">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Activity Distribution</h3>
                <p className="text-xs text-slate-400 font-medium">{activityTotal.toLocaleString()}m total</p>
              </div>
            </div>
            
            <EnhancedPieChart data={activityData} total={activityTotal} />
          </div>
        )}
    </div>
  );
}
