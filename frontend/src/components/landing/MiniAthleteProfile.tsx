import { useState } from 'react';
import { TrendingUp, Award, Calendar, Target, Zap } from 'lucide-react';
import { sampleSwimmers } from '@/data/landingDemoData';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}`;
};

export default function MiniAthleteProfile() {
  const [selectedSwimmer, setSelectedSwimmer] = useState(sampleSwimmers[0]);

  // Get recent performance
  const latestTime = selectedSwimmer.recentTimes[0];
  const previousTime = selectedSwimmer.recentTimes[1];
  const timeImprovement = ((previousTime.time - latestTime.time) / previousTime.time * 100).toFixed(1);

  // Calculate projected goal
  const projectedGoal = latestTime.time * 0.97; // 3% improvement

  return (
    <div className="relative bg-linear-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-500 shadow-2xl hover:shadow-cyan-500/10 group">
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">

      {/* Swimmer Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {sampleSwimmers.map((swimmer) => (
          <button
            key={swimmer.id}
            onClick={() => setSelectedSwimmer(swimmer)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              selectedSwimmer.id === swimmer.id
                ? 'bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            {swimmer.name}
          </button>
        ))}
      </div>

      {/* Athlete Header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-cyan-500/30 shrink-0">
          {selectedSwimmer.name.split(' ').map(n => n[0]).join('')}
        </div>
        
        {/* Info */}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">{selectedSwimmer.name}</h3>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Age {selectedSwimmer.age}
            </span>
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              {selectedSwimmer.specialty}
            </span>
          </div>
        </div>

        {/* FINA Badge */}
        <div className="bg-linear-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl px-3 py-2 text-center">
          <div className="text-xs text-yellow-400 font-medium mb-1">FINA Points</div>
          <div className="text-xl font-bold text-yellow-300">{selectedSwimmer.finaPoints}</div>
        </div>
      </div>

      {/* Performance Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Latest Time</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{formatTime(latestTime.time)}</div>
          <div className="text-xs text-green-400 mt-1">-{timeImprovement}% vs last meet</div>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Season Growth</span>
          </div>
          <div className="text-2xl font-bold bg-linear-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">+{selectedSwimmer.improvement}%</div>
          <div className="text-xs text-slate-400 mt-1">6-month progression</div>
        </div>
      </div>

      {/* Recent Times Table */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden mb-6">
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/30">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Recent Meets</h4>
        </div>
        <div className="divide-y divide-slate-700/30">
          {selectedSwimmer.recentTimes.slice(0, 4).map((timeEntry, idx) => (
            <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  idx === 0 ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50' : 'bg-slate-600'
                }`} />
                <span className="text-sm text-slate-400 font-medium">{timeEntry.date}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono font-semibold text-white">{formatTime(timeEntry.time)}</span>
                <span className="text-xs text-slate-500 tabular-nums w-12 text-right">{timeEntry.finaPoints} pts</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Predictive Goal */}
      <div className="bg-linear-to-r from-purple-500/10 via-cyan-500/10 to-blue-500/5 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
            <Target className="w-5 h-5 text-purple-300" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white text-sm mb-1.5 flex items-center gap-2">
              <span>AI Goal Prediction</span>
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">Beta</span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed mb-2">
              Based on current trajectory, {selectedSwimmer.name.split(' ')[0]} is projected to achieve a{' '}
              <span className="font-bold text-cyan-300 font-mono">{formatTime(projectedGoal)}</span> in the{' '}
              {selectedSwimmer.specialty} by the next championship meet.
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="flex-1 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                <div className="bg-linear-to-r from-cyan-500 to-purple-500 h-full rounded-full" style={{ width: '73%' }} />
              </div>
              <span className="font-medium">73% confidence</span>
            </div>
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
