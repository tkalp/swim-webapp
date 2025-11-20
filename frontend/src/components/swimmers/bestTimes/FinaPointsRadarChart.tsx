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
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-6 backdrop-blur-sm shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-background-secondary/50 rounded w-1/3"></div>
          <div className="h-64 bg-background-secondary/50 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data || Object.keys(data.by_stroke).length === 0) {
    return (
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-6 backdrop-blur-sm shadow-lg">
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
          <p className="text-text-secondary text-sm">
            {error || "No FINA points data available yet"}
          </p>
          <p className="text-text-tertiary text-xs mt-1">
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const strokeKey = Object.keys(STROKE_DISPLAY_NAMES).find(
        key => STROKE_DISPLAY_NAMES[key] === data.stroke
      ) || data.stroke.toLowerCase();
      const strokeData = strokeKey ? finaData?.by_stroke[strokeKey] : null;
      
      return (
        <div className="bg-background-elevated/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl p-3">
          <p className="font-semibold text-text-primary mb-2">{data.stroke}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary">Best Score:</span>
              <span className="font-bold text-accent">{data.points} pts</span>
            </div>
            {strokeData && strokeData.best_by_distance && (
              <div className="mt-2 pt-2 border-t border-border/40">
                <p className="text-text-tertiary mb-1">Best Events:</p>
                {Object.entries(strokeData.best_by_distance)
                  .sort((a, b) => b[1].fina_points - a[1].fina_points)
                  .map(([distance, result]) => (
                    <div key={distance} className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary">{distance}m:</span>
                      <span className="font-medium text-text-primary">
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
    <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-6 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center shadow-md shadow-accent/25">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              FINA Points Performance
            </h3>
            <p className="text-xs text-text-tertiary">
              Best scores by stroke • {course} Pool
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            {data.overall_best_fina_points}
          </div>
          <div className="text-xs text-text-tertiary">Peak Score</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-background-secondary/30 rounded-lg p-4 border border-border/40 hover:border-accent/40 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="text-xs text-text-tertiary uppercase tracking-wider">Peak Score</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">
            {data.overall_best_fina_points}
          </div>
        </div>
        <div className="bg-background-secondary/30 rounded-lg p-4 border border-border/40 hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-text-tertiary uppercase tracking-wider">Best Event</span>
          </div>
          <div className="space-y-1">
            <div className="text-base font-bold text-text-primary">
              {data.overall_best_result.distance}m {STROKE_DISPLAY_NAMES[data.overall_best_result.stroke] || data.overall_best_result.stroke}
            </div>
            <div className="text-sm font-mono font-semibold text-accent">
              {formatTime(data.overall_best_result.time_seconds)}
            </div>
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={chartData}>
            <defs>
              <linearGradient id="colorBest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <PolarGrid
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth={1}
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="stroke"
              tick={{
                fill: "rgb(148, 163, 184)",
                fontSize: 13,
                fontWeight: 600,
              }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 1000]}
              tick={{
                fill: "rgb(148, 163, 184)",
                fontSize: 11,
              }}
              tickCount={6}
              axisLine={false}
            />
            <Radar
              name="Best Score"
              dataKey="points"
              stroke="#6366f1"
              fill="url(#colorBest)"
              fillOpacity={0.6}
              strokeWidth={3}
              dot={{
                r: 5,
                fill: "#6366f1",
                strokeWidth: 2,
                stroke: "#fff",
              }}
              activeDot={{
                r: 7,
                fill: "#6366f1",
                strokeWidth: 3,
                stroke: "#fff",
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                fontSize: "13px",
                fontWeight: 600,
              }}
              iconType="circle"
              formatter={(value: string) => (
                <span className="text-text-secondary">{value}</span>
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Stroke Breakdown */}
      <div className="mt-6 space-y-3">
        <h4 className="text-sm font-semibold text-text-secondary mb-3">
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
                className="group relative bg-background-secondary/20 rounded-lg p-4 border border-border/30 hover:border-border/60 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-text-primary">
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
                        <span className="font-medium text-text-secondary">
                          {bestDistance[0]}m
                        </span>
                        <span className="text-text-tertiary">•</span>
                        <span className="font-mono font-semibold text-accent">
                          {formatTime(bestDistance[1].time_seconds)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-text-tertiary">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-background-secondary rounded-full overflow-hidden">
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
