import { useState } from 'react';
import { Sparkles, Award, Zap, Waves, Clock, TrendingUp, Target, Activity } from 'lucide-react';
import { sampleSwimmers, sampleWorkouts } from '@/data/landingDemoData';

export default function MiniWorkoutGenerator() {
  const [selectedSwimmer, setSelectedSwimmer] = useState(sampleSwimmers[0]);
  const [intensity, setIntensity] = useState(75);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState(sampleWorkouts[0]);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      // Pick workout based on intensity
      const workout = intensity > 80 
        ? sampleWorkouts[1] // Sprint Power
        : intensity > 60 
        ? sampleWorkouts[0] // Threshold Endurance
        : sampleWorkouts[4]; // Recovery
      setGeneratedWorkout(workout);
      setIsGenerating(false);
    }, 800);
  };

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

      {/* Input Controls */}
      <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-semibold text-white">AI Workout Parameters</h4>
        </div>

        {/* Athlete Info */}
        <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block mb-1">Athlete</span>
              <span className="text-white font-medium">{selectedSwimmer.name.split(' ')[0]}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">FINA Points</span>
              <span className="text-cyan-400 font-bold">{selectedSwimmer.finaPoints}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Specialty</span>
              <span className="text-white font-medium">{selectedSwimmer.specialty}</span>
            </div>
          </div>
        </div>

        {/* Intensity Slider */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Training Intensity</label>
            <span className="text-sm font-bold text-white">{intensity}%</span>
          </div>
          <input
            type="range"
            min="40"
            max="100"
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${intensity}%, #334155 ${intensity}%, #334155 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Recovery</span>
            <span>Moderate</span>
            <span>High Intensity</span>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3 bg-linear-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-700 rounded-lg font-semibold text-white transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate AI Workout
            </>
          )}
        </button>
      </div>

      {/* Generated Workout Display */}
      <div className="bg-linear-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
            <Waves className="w-5 h-5 text-purple-300" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white text-sm mb-1">{generatedWorkout.name}</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{generatedWorkout.description}</p>
          </div>
        </div>

        {/* Workout Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Waves className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="text-xs text-slate-400 mb-0.5">Distance</div>
            <div className="text-sm font-bold text-white">{generatedWorkout.totalYards}y</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="w-3 h-3 text-green-400" />
            </div>
            <div className="text-xs text-slate-400 mb-0.5">Sets</div>
            <div className="text-sm font-bold text-white">{generatedWorkout.sets}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="w-3 h-3 text-purple-400" />
            </div>
            <div className="text-xs text-slate-400 mb-0.5">Focus</div>
            <div className="text-xs font-bold text-white truncate">{generatedWorkout.focus}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-yellow-400" />
            </div>
            <div className="text-xs text-slate-400 mb-0.5">Rating</div>
            <div className="text-sm font-bold text-white">{generatedWorkout.effectiveness}★</div>
          </div>
        </div>

        {/* Effectiveness Metrics */}
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Historical Success Rate</span>
            <span className="text-xs font-bold text-green-400">+{generatedWorkout.avgImprovement}% avg improvement</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>Used {generatedWorkout.timesUsed} times by similar athletes</span>
          </div>
        </div>
      </div>

      {/* AI Insight */}
      <div className="bg-linear-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/5 border border-cyan-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
            <Zap className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white text-sm mb-1.5 flex items-center gap-2">
              <span>ML Recommendation</span>
              <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full">Beta</span>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              This workout is optimized for {selectedSwimmer.name.split(' ')[0]}'s current fitness level and {selectedSwimmer.specialty} specialty. 
              Based on {generatedWorkout.timesUsed} similar athletes, expect {generatedWorkout.avgImprovement}% performance improvement within 4-6 weeks.
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
