import { Link } from 'react-router-dom';
import { Users, Sparkles, Target, TrendingUp } from 'lucide-react';

interface ToolCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
  gradient: string;
}

function ToolCard({ icon: Icon, title, description, path, gradient }: ToolCardProps) {
  return (
    <Link
      to={path}
      className="group relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10"
    >
      {/* Gradient overlay on hover */}
      <div className={`absolute inset-0 bg-linear-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
      
      <div className="relative z-10">
        <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={24} className="text-white" strokeWidth={2} />
        </div>
        
        <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-cyan-400 transition-colors">
          {title}
        </h3>
        
        <p className="text-slate-400 text-sm leading-relaxed">
          {description}
        </p>
        
        <div className="mt-4 flex items-center gap-2 text-cyan-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span>Explore Tool</span>
          <TrendingUp size={16} />
        </div>
      </div>
    </Link>
  );
}

export default function Tools() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Coaching Tools
          </h1>
          <p className="text-slate-400 text-lg max-w-3xl">
            Powerful analytics and AI-driven insights to help you make better coaching decisions
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ToolCard
            icon={Users}
            title="Swimmer Comparison"
            description="Compare two swimmers head-to-head with detailed performance analytics, predictions, and race outcome probabilities."
            path="/tools/comparison"
            gradient="from-cyan-500 to-blue-500"
          />
          
          <ToolCard
            icon={Sparkles}
            title="AI Coach Assistant"
            description="Get personalized coaching recommendations, workout suggestions, and training insights powered by advanced AI."
            path="/tools/ai-coach"
            gradient="from-purple-500 to-pink-500"
          />
          
          <ToolCard
            icon={Target}
            title="Time Standards"
            description="Access comprehensive swimming time standards for all events, age groups, and competition levels."
            path="/tools/standards"
            gradient="from-orange-500 to-red-500"
          />
        </div>

        {/* Coming Soon Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-slate-300 mb-6">Coming Soon</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-700/30 rounded-2xl p-6 opacity-60">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4">
                <TrendingUp size={24} className="text-white" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">Performance Trends</h3>
              <p className="text-slate-500 text-sm">Track swimmer progress over time with advanced trend analysis</p>
            </div>
            
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-700/30 rounded-2xl p-6 opacity-60">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-yellow-500 to-orange-500 flex items-center justify-center mb-4">
                <Target size={24} className="text-white" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">Goal Tracker</h3>
              <p className="text-slate-500 text-sm">Set and monitor individual and team goals with milestone tracking</p>
            </div>
            
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-700/30 rounded-2xl p-6 opacity-60">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-4">
                <Users size={24} className="text-white" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">Team Analytics</h3>
              <p className="text-slate-500 text-sm">Deep dive into team performance metrics and squad comparisons</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
