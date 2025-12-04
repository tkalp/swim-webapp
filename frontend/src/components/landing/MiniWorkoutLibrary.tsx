import { useState } from 'react';
import { Search, Award, Zap, TrendingUp, Clock, Filter } from 'lucide-react';
import { sampleWorkouts } from '@/data/landingDemoData';

export default function MiniWorkoutLibrary() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'effectiveness' | 'recent'>('effectiveness');

  // Filter and sort workouts
  const filteredWorkouts = sampleWorkouts
    .filter(workout => 
      workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workout.focus.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workout.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'effectiveness') {
        return b.effectiveness - a.effectiveness;
      }
      return b.timesUsed - a.timesUsed;
    });

  const getEffectivenessColor = (rating: number) => {
    if (rating >= 4.8) return 'text-green-400';
    if (rating >= 4.5) return 'text-cyan-400';
    return 'text-yellow-400';
  };

  const getFocusColor = (focus: string) => {
    const colors: Record<string, string> = {
      'Speed & Power': 'bg-red-500/20 text-red-300 border-red-500/30',
      'Aerobic Capacity': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'Technique': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'Race Strategy': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'Recovery': 'bg-green-500/20 text-green-300 border-green-500/30',
    };
    return colors[focus] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  return (
    <div className="relative bg-linear-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-500 shadow-2xl hover:shadow-cyan-500/10 group">
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">

      {/* Search and Filter Controls */}
      <div className="mb-6">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search workouts by name or focus..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>

        {/* Sort Buttons */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 mr-2">Sort by:</span>
          <button
            onClick={() => setSortBy('effectiveness')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'effectiveness'
                ? 'bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            Effectiveness
          </button>
          <button
            onClick={() => setSortBy('recent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === 'recent'
                ? 'bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            Most Used
          </button>
        </div>
      </div>

      {/* Workout Library List */}
      <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
        {filteredWorkouts.length > 0 ? (
          filteredWorkouts.map((workout) => (
            <div
              key={workout.id}
              className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30 hover:border-cyan-500/30 hover:bg-slate-800/80 transition-all cursor-pointer group/item"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white mb-1 group-hover/item:text-cyan-400 transition-colors">
                    {workout.name}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {workout.description}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-0.5">Distance</div>
                  <div className="text-sm font-bold text-white">{workout.totalYards}y</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-0.5">Sets</div>
                  <div className="text-sm font-bold text-white">{workout.sets}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-0.5">Rating</div>
                  <div className={`text-sm font-bold ${getEffectivenessColor(workout.effectiveness)}`}>
                    {workout.effectiveness}★
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-0.5">Used</div>
                  <div className="text-sm font-bold text-cyan-400">{workout.timesUsed}x</div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
                <div className={`text-xs px-2 py-1 rounded-md border ${getFocusColor(workout.focus)}`}>
                  {workout.focus}
                </div>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>+{workout.avgImprovement}% avg</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No workouts found</p>
          </div>
        )}
      </div>

      {/* AI Insight */}
      <div className="bg-linear-to-r from-purple-500/10 via-cyan-500/10 to-blue-500/5 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
            <Zap className="w-5 h-5 text-purple-300" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white text-sm mb-1.5 flex items-center gap-2">
              <span>Smart Recommendations</span>
              <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">AI</span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              The database tracks effectiveness metrics for each workout, learning from {sampleWorkouts.reduce((sum, w) => sum + w.timesUsed, 0)}+ 
              historical sessions. Workouts are automatically ranked by success rate and performance improvement.
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
