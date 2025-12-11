import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, ComposedChart, ReferenceArea, ReferenceLine } from 'recharts';
import { formatTime } from '@/utils/timeUtils';
import { BarChart3, TrendingDown, ZoomIn, ZoomOut } from 'lucide-react';

type ChartDataPoint = {
  i: number;
  date: string;
  seconds: number;
  otherTimes?: number[];
};

type AttemptsChartProps = {
  data: ChartDataPoint[];
};

// Custom tooltip component for better interaction
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const point = payload[0].payload as ChartDataPoint;
    const time = payload[0].value;
    const hasOtherTimes = point.otherTimes && point.otherTimes.length > 0;

    return (
      <div className="bg-slate-900/95 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-cyan-400 text-xs font-medium mb-1">
          {point.date}
        </p>
        <p className="text-white font-bold text-lg font-mono mb-1">
          {formatTime(time)}
        </p>
        {hasOtherTimes && (
          <div className="pt-1 border-t border-slate-700/50 mt-1">
            <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">
              Also swam:
            </p>
            {point.otherTimes!.map((otherTime, idx) => (
              <p key={idx} className="text-slate-400 text-sm font-mono">
                {formatTime(otherTime)}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function AttemptsChart({ data }: AttemptsChartProps) {
  // Zoom state
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [zoomDomain, setZoomDomain] = useState<{ left: number; right: number } | null>(null);

  // Adaptive display based on data points
  const showDots = data.length <= 15;
  const shouldRotateLabels = data.length > 10;
  const tickInterval = data.length > 20 ? Math.ceil(data.length / 10) : data.length > 10 ? Math.ceil(data.length / 8) : 0;
  
  // Calculate best time for highlighting
  const bestTime = Math.min(...data.map(d => d.seconds));
  const worstTime = Math.max(...data.map(d => d.seconds));

  // Get the visible data based on zoom
  const visibleData = zoomDomain 
    ? data.slice(zoomDomain.left, zoomDomain.right + 1)
    : data;

  // Adaptive x-axis display based on visible data points
  const visibleDataLength = visibleData.length;
  const shouldRotateLabelsForZoom = visibleDataLength > 10;
  const tickIntervalForZoom = visibleDataLength > 20 
    ? Math.ceil(visibleDataLength / 10) 
    : visibleDataLength > 10 
    ? Math.ceil(visibleDataLength / 8) 
    : 0;

  // Zoom handlers
  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
    }
  };

  const handleMouseMove = (e: any) => {
    if (refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight) {
      // Find indices of the selected area
      const leftIndex = data.findIndex(d => d.date === refAreaLeft);
      const rightIndex = data.findIndex(d => d.date === refAreaRight);
      
      if (leftIndex !== -1 && rightIndex !== -1) {
        const left = Math.min(leftIndex, rightIndex);
        const right = Math.max(leftIndex, rightIndex);
        
        // Only zoom if selection is meaningful (more than 1 point)
        if (right - left > 0) {
          setZoomDomain({ left, right });
        }
      }
    }
    
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const handleZoomOut = () => {
    setZoomDomain(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };
  
  const isZoomed = zoomDomain !== null;
  
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
          <p className="text-xs text-slate-500 mt-0.5">
            {isZoomed ? 'Click Reset Zoom to see all data' : 'Click and drag on chart to zoom'}
          </p>
        </div>
        {isZoomed && (
          <button
            onClick={handleZoomOut}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-cyan-500/30 rounded-lg text-slate-300 hover:text-cyan-400 transition-all duration-200 text-sm font-medium"
          >
            <ZoomOut size={16} />
            Reset Zoom
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="relative group">
        {/* Hover effect */}
        <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart 
            data={visibleData} 
            margin={{ 
              top: 20, 
              right: 30, 
              left: 20, 
              bottom: shouldRotateLabelsForZoom ? 60 : 30 
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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
              interval={tickIntervalForZoom}
              angle={shouldRotateLabelsForZoom ? -45 : 0}
              textAnchor={shouldRotateLabelsForZoom ? "end" : "middle"}
              height={shouldRotateLabelsForZoom ? 80 : 50}
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

            {/* Zoom selection area */}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea
                x1={refAreaLeft}
                x2={refAreaRight}
                strokeOpacity={0.3}
                fill="#22d3ee"
                fillOpacity={0.3}
              />
            )}

            {/* Best time reference line */}
            <ReferenceLine
              y={bestTime}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: `Best: ${formatTime(bestTime)}`,
                position: 'insideTopLeft',
                fill: '#10b981',
                fontSize: 12,
                fontWeight: 600,
                offset: 10
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
              dot={showDots ? {
                r: 5,
                fill: '#22d3ee',
                stroke: '#0891b2',
                strokeWidth: 2
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
              <div className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-cyan-600"></div>
              <span className="text-slate-400">Attempt</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-500"></div>
              <span className="text-slate-400">Best Time</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}