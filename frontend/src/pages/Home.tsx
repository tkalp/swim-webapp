// pages/Home.tsx
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from "react-router-dom"
import { Sparkles, Users, Wrench, Settings as SettingsIcon, LogOut, TrendingUp } from "lucide-react"
import logo from '@/assets/logo.png'

export default function Home() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const features = [
    {
      id: "squads",
      title: "Squads",
      description: "Manage your swim teams and track performance",
      icon: Users,
      path: "/squads",
      color: "#3197a7",
      available: true,
    },
    {
      id: "ai-coach",
      title: "AI Coach",
      description: "Generate custom workouts with AI assistance",
      icon: Sparkles,
      path: "/ai-coach",
      color: "#8B5CF6",
      available: true,
    },
    {
      id: "tools",
      title: "Tools",
      description: "Pace calculators and training utilities",
      icon: Wrench,
      path: "/tools",
      color: "#265D74",
      available: false,
    },
    {
      id: "analytics",
      title: "Analytics",
      description: "Track progress and analyze performance data",
      icon: TrendingUp,
      path: "/analytics",
      color: "#10b981",
      available: false,
    },
  ]

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-100 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/60 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Aquilus" className="w-8 h-8 object-contain" />
            <span className="text-2xl font-bold bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              aquilus
            </span>
          </div>

          <button 
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 hover:text-white font-medium transition-all duration-200 hover:bg-slate-700/50 hover:border-slate-600/50 hover:scale-105"
            onClick={signOut}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Welcome Section */}
        <section className="text-center py-8">
          <h1 className="text-5xl font-bold mb-4 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-transparent leading-tight">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Ready to dive into your training? Choose from the tools below to get started.
          </p>
        </section>

        {/* Feature Cards */}
        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-slate-100">Your Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((feature) => (
              <button
                key={feature.id}
                className={`bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-8 flex flex-col gap-6 text-left relative overflow-hidden group transition-all duration-300 ${
                  feature.available 
                    ? 'cursor-pointer hover:border-cyan-500/30 hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/10' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => feature.available && navigate(feature.path)}
                disabled={!feature.available}
              >
                <div className="flex items-start justify-between gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 shadow-lg border border-cyan-500/20"
                    style={{ background: `${feature.color}30` }}
                  >
                    <feature.icon size={32} strokeWidth={2} style={{ color: feature.color }} />
                  </div>
                  {!feature.available && (
                    <span className="px-3 py-1.5 bg-linear-to-r from-purple-500 to-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                      Soon
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-slate-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-base text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                {feature.available && (
                  <div className="text-2xl text-cyan-400 self-end opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                    →
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-br from-cyan-500/0 via-blue-500/0 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </button>
            ))}
          </div>
        </section>

        {/* User Info Card */}
        <section className="mt-auto pt-8">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-slate-100 mb-1">
                {user?.user_metadata?.full_name || "User"}
              </div>
              <div className="text-sm text-slate-400">{user?.email}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}