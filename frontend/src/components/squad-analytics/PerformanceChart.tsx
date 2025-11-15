import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SwimmerPerformance, formatTimeFromSeconds } from '../../features/squads/metricsApi';

interface PerformanceChartProps {
  swimmers: SwimmerPerformance[];
  selectedEvent?: string;
}

const COLORS = [
  '#22D3EE', // cyan
  '#8B5CF6', // purple
  '#F59E0B', // orange
  '#22C55E', // green
  '#EF4444', // red
  '#3B82F6', // blue
  '#EC4899', // pink
  '#10B981', // emerald
];

export default function PerformanceChart({ swimmers, selectedEvent }: PerformanceChartProps) {
  // Build chart data from swimmers' timeline data
  const chartData = buildChartData(swimmers, selectedEvent);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-background-elevated border border-border rounded-2xl">
        <p className="text-text-muted">No performance data available for the selected period</p>
      </div>
    );
  }

  return (
    <div className="bg-background-elevated border border-border rounded-2xl p-6 shadow-lg">
      <h3 className="text-lg font-semibold text-text-primary mb-6">
        {selectedEvent ? `Performance Trend - ${formatEventName(selectedEvent)}` : 'Performance Trends'}
      </h3>
      
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => formatTimeFromSeconds(value)}
            reversed // Faster times at top
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '12px'
            }}
            labelStyle={{ color: '#F8FAFC', fontWeight: 600, marginBottom: '8px' }}
            itemStyle={{ color: '#F8FAFC' }}
            formatter={(value: number) => formatTimeFromSeconds(value)}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          {swimmers.map((swimmer, index) => (
            <Line
              key={swimmer.swimmer_id}
              type="monotone"
              dataKey={swimmer.swimmer_id}
              name={swimmer.swimmer_name}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ fill: COLORS[index % COLORS.length], r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 flex flex-wrap gap-3">
        {swimmers.map((swimmer, index) => (
          <div 
            key={swimmer.swimmer_id}
            className="flex items-center gap-2 px-3 py-1.5 bg-background-secondary border border-border rounded-lg"
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-sm font-medium text-text-secondary">
              {swimmer.swimmer_name}
            </span>
            <span className="text-xs text-text-tertiary">
              ({swimmer.avg_improvement_pct > 0 ? '+' : ''}{swimmer.avg_improvement_pct.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildChartData(swimmers: SwimmerPerformance[], selectedEvent?: string) {
  // Collect all unique dates across all swimmers
  const allDates = new Set<string>();
  const swimmerData: Record<string, Record<string, number>> = {};

  swimmers.forEach(swimmer => {
    swimmerData[swimmer.swimmer_id] = {};
    
    const events = selectedEvent 
      ? swimmer.events.filter(e => e.event === selectedEvent)
      : swimmer.events;

    events.forEach(event => {
      event.timeline.forEach(({ date, time }) => {
        allDates.add(date);
        // Take best time for that date if multiple
        if (!swimmerData[swimmer.swimmer_id][date] || time < swimmerData[swimmer.swimmer_id][date]) {
          swimmerData[swimmer.swimmer_id][date] = time;
        }
      });
    });
  });

  // Sort dates
  const sortedDates = Array.from(allDates).sort();

  // Build chart data array
  return sortedDates.map(date => {
    const dataPoint: any = { date: formatDate(date) };
    
    swimmers.forEach(swimmer => {
      dataPoint[swimmer.swimmer_id] = swimmerData[swimmer.swimmer_id][date] || null;
    });

    return dataPoint;
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEventName(eventKey: string): string {
  // "100Y_freestyle_swim" -> "100Y Freestyle"
  const parts = eventKey.split('_');
  const distance = parts[0];
  const stroke = parts[1]?.charAt(0).toUpperCase() + parts[1]?.slice(1);
  return `${distance} ${stroke}`;
}
