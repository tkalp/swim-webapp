import { useState } from 'react';
import { Brain, TrendingUp, Target, Zap, Award, AlertCircle } from 'lucide-react';

interface WorkoutSuggestion {
  id: string;
  focus: string;
  rationale: string;
  metrics: {
    expectedImprovement: string;
    targetZone: string;
    recovery: string;
  };
  sets: {
    distance: string;
    pace: string;
    rest: string;
    purpose: string;
  }[];
}

const athleteGoals = [
  { id: 'sprint', name: 'Sprint Speed', icon: Zap, color: 'from-yellow-500 to-orange-500' },
  { id: 'endurance', name: 'Endurance', icon: TrendingUp, color: 'from-blue-500 to-cyan-500' },
  { id: 'technique', name: 'Technique', icon: Target, color: 'from-purple-500 to-pink-500' },
];

const workoutSuggestions: Record<string, WorkoutSuggestion> = {
  sprint: {
    id: 'sprint',
    focus: 'Explosive Power & Speed',
    rationale: 'Based on your recent 50m times showing plateau at 24.8s, AI recommends high-intensity sprint work with extended recovery to break through.',
    metrics: {
      expectedImprovement: '0.3-0.5s in 50m',
      targetZone: '95-100% max effort',
      recovery: '48 hours recommended',
    },
    sets: [
      { distance: '8 × 25m', pace: 'All-out sprint', rest: '60s', purpose: 'Neuromuscular activation' },
      { distance: '6 × 50m', pace: '23.5-24.0s target', rest: '3min', purpose: 'Speed endurance' },
      { distance: '4 × 15m', pace: 'Explosive starts', rest: '90s', purpose: 'Power development' },
      { distance: '200m', pace: 'Easy recovery', rest: '—', purpose: 'Cool down' },
    ],
  },
  endurance: {
    id: 'endurance',
    focus: 'Aerobic Base & Stamina',
    rationale: 'Your 400m splits show fatigue in final 100m. AI prescribes threshold training to improve lactate clearance and maintain pace.',
    metrics: {
      expectedImprovement: '2-4s in 400m',
      targetZone: '75-85% max HR',
      recovery: '24 hours recommended',
    },
    sets: [
      { distance: '1000m', pace: 'Steady @ 1:25/100m', rest: '—', purpose: 'Warm up gradually' },
      { distance: '5 × 200m', pace: '1:15/100m', rest: '30s', purpose: 'Threshold training' },
      { distance: '3 × 400m', pace: '1:18/100m', rest: '45s', purpose: 'Race pace simulation' },
      { distance: '400m', pace: 'Easy recovery', rest: '—', purpose: 'Cool down' },
    ],
  },
  technique: {
    id: 'technique',
    focus: 'Stroke Mechanics & Efficiency',
    rationale: 'Stroke count analysis shows inconsistency: 16-19 strokes per 25m. AI targets stroke efficiency to reduce drag and improve DPS.',
    metrics: {
      expectedImprovement: '1-2 strokes per length',
      targetZone: '60-70% effort',
      recovery: 'Daily (low intensity)',
    },
    sets: [
      { distance: '400m', pace: 'Drill focus', rest: '—', purpose: 'Movement prep' },
      { distance: '8 × 50m', pace: '14 strokes/25m max', rest: '20s', purpose: 'Stroke economy' },
      { distance: '6 × 75m', pace: 'Descend by feel', rest: '30s', purpose: 'Apply technique at speed' },
      { distance: '300m', pace: 'Perfect form', rest: '—', purpose: 'Reinforce patterns' },
    ],
  },
};

export default function MiniAICoach() {
  const [selectedGoal, setSelectedGoal] = useState('sprint');
  const workout = workoutSuggestions[selectedGoal];
  const currentGoal = athleteGoals.find(g => g.id === selectedGoal)!;

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-linear-to-r from-purple-500/10 to-cyan-500/10 border-b border-slate-700/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-linear-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI Workout Designer</h3>
            <p className="text-xs text-slate-400">Personalized training based on your performance data</p>
          </div>
        </div>

        {/* Goal Selector */}
        <div className="grid grid-cols-3 gap-2">
          {athleteGoals.map((goal) => {
            const Icon = goal.icon;
            const isActive = selectedGoal === goal.id;
            return (
              <button
                key={goal.id}
                onClick={() => setSelectedGoal(goal.id)}
                className={`p-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? `bg-linear-to-br ${goal.color} shadow-lg`
                    : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50'
                }`}
              >
                <Icon className={`w-4 h-4 mx-auto mb-1 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className={`text-xs font-medium ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {goal.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workout Content */}
      <div className="p-6 space-y-6">
        {/* AI Rationale */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg bg-linear-to-br ${currentGoal.color} flex items-center justify-center shrink-0`}>
              <currentGoal.icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white mb-1">{workout.focus}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{workout.rationale}</p>
            </div>
          </div>
        </div>

        {/* Expected Outcomes */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <TrendingUp className="w-4 h-4 text-green-400 mb-1" />
            <div className="text-xs text-slate-400">Improvement</div>
            <div className="text-sm font-semibold text-white">{workout.metrics.expectedImprovement}</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <Target className="w-4 h-4 text-cyan-400 mb-1" />
            <div className="text-xs text-slate-400">Target Zone</div>
            <div className="text-sm font-semibold text-white">{workout.metrics.targetZone}</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <AlertCircle className="w-4 h-4 text-orange-400 mb-1" />
            <div className="text-xs text-slate-400">Recovery</div>
            <div className="text-sm font-semibold text-white">{workout.metrics.recovery}</div>
          </div>
        </div>

        {/* Workout Sets */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            Today's Workout
          </h4>
          <div className="space-y-2">
            {workout.sets.map((set, idx) => (
              <div
                key={idx}
                className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{set.distance}</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-700/50 rounded text-slate-300">
                    Rest: {set.rest}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{set.pace}</span>
                  <span className="text-cyan-400">{set.purpose}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Badge */}
        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-500">
          <Award className="w-3 h-3" />
          <span>Interactive demo · AI-generated workout</span>
        </div>
      </div>
    </div>
  );
}
