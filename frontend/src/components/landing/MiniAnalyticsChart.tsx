import { useState } from 'react';
import { TrendingUp, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { sampleSwimmers } from '@/data/landingDemoData';

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-cyan-400 text-xs font-medium mb-1">{data.date}</p>
        <p className="text-white font-bold text-sm">FINA: {data.finaPoints}</p>
      </div>
    );
  }
  return null;
};

export default function MiniAnalyticsChart() {
  const [selectedSwimmer, setSelectedSwimmer] = useState(sampleSwimmers[0]);

  // Transform data for Recharts (reverse to show chronological order)
  const chartData = [...selectedSwimmer.recentTimes].reverse();

  return (
    <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-500 shadow-2xl hover:shadow-cyan-500/10 group">
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
      {/* Swimmer Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {sampleSwimmers.map((swimmer) => (
          <button
            key={swimmer.id}
            onClick={() => setSelectedSwimmer(swimmer)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              selectedSwimmer.id === swimmer.id
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {swimmer.name}
          </button>
        ))}
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30 hover:border-cyan-500/30 transition-all hover:bg-slate-800/80">
          <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Current FINA</div>
          <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">{selectedSwimmer.finaPoints}</div>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30 hover:border-green-500/30 transition-all hover:bg-slate-800/80">
          <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">6-Month Gain</div>
          <div className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">+{selectedSwimmer.improvement}%</div>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30 hover:border-blue-500/30 transition-all hover:bg-slate-800/80">
          <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Event</div>
          <div className="text-lg font-bold text-white">{selectedSwimmer.specialty}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-56 bg-gradient-to-br from-slate-950/80 to-slate-900/60 rounded-xl p-4 border border-slate-700/40 shadow-inner">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
            
            <XAxis 
              dataKey="date" 
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={{ stroke: '#334155' }}
            />
            
            <YAxis 
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={{ stroke: '#334155' }}
              domain={['dataMin - 20', 'dataMax + 20']}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Area 
              type="monotone" 
              dataKey="finaPoints" 
              fill="url(#colorGradient)" 
              stroke="none"
            />
            
            <Line 
              type="monotone" 
              dataKey="finaPoints" 
              stroke="#06b6d4"
              strokeWidth={3}
              dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4, stroke: '#fff' }}
              activeDot={{ r: 6, stroke: '#06b6d4', strokeWidth: 2, fill: '#fff' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="mt-6 flex items-start gap-3 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/5 border border-cyan-500/30 rounded-xl p-4 hover:border-cyan-400/50 transition-all">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
          <TrendingUp className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <div className="font-semibold text-white text-sm mb-1.5 flex items-center gap-2">
            <span>AI-Powered Insight</span>
            <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full">Beta</span>
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            {selectedSwimmer.name} has shown consistent improvement with {selectedSwimmer.improvement}% FINA point gain over 6 months. 
            Current trajectory suggests reaching {Math.round(selectedSwimmer.finaPoints * 1.05)} points by next competition cycle.
          </div>
        </div>
      </div>

      {/* Demo Badge */}
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400 border-t border-slate-700/30 pt-4">
        <Award className="w-3.5 h-3.5 text-cyan-500/60" />
        <span className="font-medium">Interactive demo · Sample data</span>
      </div>
      </div>
    </div>
  );
}
