// components/swimmers/bestTimes/FinaPointsRadarChart.tsx
import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { getSwimmerFinaPoints, type FinaPointsResponse } from '@/services/finaPointsService';
import { formatTime } from '@/utils/timeUtils';
import { Trophy, Activity } from "lucide-react";

interface FinaPointsRadarChartProps {
  swimmerId: string;
  gender: string;
  course?: "LCM" | "SCM";
}

const STROKE_DISPLAY_NAMES: { [key: string]: string } = {
  freestyle: "Freestyle",
  backstroke: "Backstroke",
  breaststroke: "Breaststroke",
  butterfly: "Butterfly",
  "individual medley": "IM",
  free: "Freestyle",
  back: "Backstroke",
  breast: "Breaststroke",
  fly: "Butterfly",
  im: "IM",
};

const STROKE_COLORS: { [key: string]: string } = {
  freestyle: "#3b82f6", // blue
  backstroke: "#8b5cf6", // purple
  breaststroke: "#ec4899", // pink
  butterfly: "#f59e0b", // amber
  "individual medley": "#10b981", // emerald
  free: "#3b82f6",
  back: "#8b5cf6",
  breast: "#ec4899",
  fly: "#f59e0b",
  im: "#10b981",
};

export default function FinaPointsRadarChart({
  swimmerId,
  gender,
  course = "LCM",
}: FinaPointsRadarChartProps) {
  const [data, setData] = useState<FinaPointsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const finaData = await getSwimmerFinaPoints(swimmerId, gender, course);
        if (mounted) {
          setData(finaData);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e.message ?? "Failed to load FINA points");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [swimmerId, gender, course]);

  if (loading) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-6 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-800/50 rounded w-1/3"></div>
          <div className="h-64 bg-slate-800/50 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data || Object.keys(data.by_stroke).length === 0) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-6 shadow-lg">
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
          <p className="text-slate-300 text-sm">
            {error || "No FINA points data available yet"}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Add some race results to see your performance analysis
          </p>
        </div>
      </div>
    );
  }

  // Transform data for radar chart - always show all 5 strokes in fixed order
  const STROKE_ORDER = ['free', 'back', 'breast', 'fly', 'im'];
  const chartData = STROKE_ORDER.map((stroke) => {
    const strokeData = data.by_stroke[stroke];
    return {
      stroke: STROKE_DISPLAY_NAMES[stroke] || stroke,
      points: strokeData?.best_fina_points || 0,
      average: strokeData?.average_fina_points || 0,
      fullMark: 1000,
    };
  });

  // Calculate dynamic domain for better visualization
  const maxPoints = Math.max(...chartData.map(d => d.points), 100);
  const domainMax = maxPoints < 300 ? 400 : maxPoints < 600 ? 800 : 1000;
  
  // Determine performance level for color coding
  const getPerformanceLevel = (points: number) => {
    if (points >= 800) return 'elite';
    if (points >= 600) return 'advanced';
    if (points >= 400) return 'intermediate';
    if (points >= 200) return 'developing';
    return 'beginner';
  };
  
  const averagePoints = chartData.reduce((sum, d) => sum + d.points, 0) / chartData.filter(d => d.points > 0).length || 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const strokeKey = Object.keys(STROKE_DISPLAY_NAMES).find(
        key => STROKE_DISPLAY_NAMES[key] === data.stroke
      ) || data.stroke.toLowerCase();
      const strokeData = strokeKey ? finaData?.by_stroke[strokeKey] : null;
      const level = getPerformanceLevel(data.points);
      const levelColors = {
        elite: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Elite' },
        advanced: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Advanced' },
        intermediate: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Intermediate' },
        developing: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Developing' },
        beginner: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Beginner' }
      };
      const levelInfo = levelColors[level];
      
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-lg shadow-xl p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="font-semibold text-slate-100">{data.stroke}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${levelInfo.bg} ${levelInfo.text}`}>
              {levelInfo.label}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300">Best Score:</span>
              <span className="font-bold text-cyan-400">{data.points} pts</span>
            </div>
            {strokeData && strokeData.best_by_distance && (
              <div className="mt-2 pt-2 border-t border-slate-700/40">
                <p className="text-slate-400 mb-1">Best Events:</p>
                {Object.entries(strokeData.best_by_distance)
                  .sort((a, b) => b[1].fina_points - a[1].fina_points)
                  .map(([distance, result]) => (
                    <div key={distance} className="flex items-center justify-between gap-2">
                      <span className="text-slate-300">{distance}m:</span>
                      <span className="font-medium text-slate-100">
                        {result.time_result} ({result.fina_points})
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const finaData = data;

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Trophy className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              FINA Points Performance
            </h3>
            <p className="text-xs text-slate-400">
              Best scores by stroke • {course} Pool
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {data.overall_best_fina_points}
          </div>
          <div className="text-xs text-slate-400">Peak Score</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 hover:border-cyan-500/40 transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Trophy className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Peak Score</span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {data.overall_best_fina_points}
          </div>
        </div>
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 hover:border-purple-500/40 transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-linear-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Best Event</span>
          </div>
          <div className="space-y-1">
            <div className="text-base font-bold text-slate-100">
              {data.overall_best_result.distance}m {STROKE_DISPLAY_NAMES[data.overall_best_result.stroke] || data.overall_best_result.stroke}
            </div>
            <div className="text-sm font-mono font-semibold text-cyan-400">
              {formatTime(data.overall_best_result.time_seconds)}
            </div>
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="relative">
        {/* Performance Level Legend */}
        <div className="absolute top-2 right-2 z-10 bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50 text-xs">
          <div className="font-semibold text-slate-200 mb-2">Performance Tiers</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-slate-300">Elite (800+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
              <span className="text-slate-300">Advanced (600+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-300">Intermediate (400+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-slate-300">Developing (200+)</span>
            </div>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={450}>
          <RadarChart data={chartData}>
            <defs>
              <linearGradient id="colorBest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
              </linearGradient>
              {/* Reference line gradients for performance tiers */}
              <linearGradient id="refLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <PolarGrid
              stroke="rgba(100, 116, 139, 0.4)"
              strokeWidth={1.5}
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="stroke"
              tick={{
                fill: "rgb(203, 213, 225)",
                fontSize: 14,
                fontWeight: 700,
              }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, domainMax]}
              tick={{
                fill: "rgb(148, 163, 184)",
                fontSize: 12,
                fontWeight: 600,
              }}
              tickCount={6}
              axisLine={false}
            />
            <Radar
              name="Best Score"
              dataKey="points"
              stroke="#06b6d4"
              fill="url(#colorBest)"
              fillOpacity={0.5}
              strokeWidth={4}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const level = getPerformanceLevel(payload.points);
                const colors = {
                  elite: '#a855f7',
                  advanced: '#06b6d4',
                  intermediate: '#10b981',
                  developing: '#eab308',
                  beginner: '#94a3b8'
                };
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill={colors[level]}
                    stroke="#0f172a"
                    strokeWidth={2.5}
                  />
                );
              }}
              activeDot={{
                r: 10,
                fill: "#06b6d4",
                strokeWidth: 3,
                stroke: "#fff",
              }}
            />
            {/* Average reference line */}
            {averagePoints > 0 && (
              <Radar
                name="Average"
                dataKey={() => averagePoints}
                stroke="#10b981"
                fill="none"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "13px",
                fontWeight: 600,
              }}
              iconType="circle"
              formatter={(value: string) => (
                <span className="text-slate-300">{value}</span>
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Stroke Breakdown */}
      <div className="mt-6 space-y-3">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Best Events by Stroke
        </h4>
        {Object.entries(data.by_stroke)
          .sort((a, b) => b[1].best_fina_points - a[1].best_fina_points)
          .map(([stroke, strokeData]) => {
            const displayName = STROKE_DISPLAY_NAMES[stroke] || stroke;
            const color = STROKE_COLORS[stroke] || "#6366f1";
            const percentage = (strokeData.best_fina_points / 1000) * 100;
            
            // Find the best distance for this stroke
            const bestDistance = Object.entries(strokeData.best_by_distance || {})
              .sort((a, b) => b[1].fina_points - a[1].fina_points)[0];

            return (
              <div
                key={stroke}
                className="group relative bg-slate-800/30 rounded-xl p-4 border border-slate-700/40 hover:border-slate-600/60 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-slate-100">
                        {displayName}
                      </span>
                      <span
                        className="text-lg font-bold"
                        style={{ color }}
                      >
                        {strokeData.best_fina_points}
                      </span>
                    </div>
                    {bestDistance && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-300">
                          {bestDistance[0]}m
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="font-mono font-semibold text-cyan-400">
                          {formatTime(bestDistance[1].time_seconds)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-slate-400">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-slate-800/50 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${color}dd, ${color}88)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
