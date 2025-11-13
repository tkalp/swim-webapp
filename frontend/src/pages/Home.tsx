// pages/Home.tsx
import { useAuth } from "../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { Sparkles, Users, Wrench, Settings as SettingsIcon, LogOut, Waves, TrendingUp } from "lucide-react"

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
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      {/* Header */}
      <header className="sticky top-0 z-[100] bg-background-elevated/95 backdrop-blur-xl border-b border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Waves size={32} className="text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
              aquilus
            </span>
          </div>

          <button 
            className="flex items-center gap-2 px-5 py-2.5 bg-background-elevated border border-border/60 rounded-xl text-text-secondary font-medium transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:text-primary hover:scale-105"
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
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent leading-tight">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Ready to dive into your training? Choose from the tools below to get started.
          </p>
        </section>

        {/* Feature Cards */}
        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-text-primary">Your Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((feature) => (
              <button
                key={feature.id}
                className={`bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-8 flex flex-col gap-6 text-left relative overflow-hidden group transition-all duration-200 ${
                  feature.available 
                    ? 'cursor-pointer hover:border-primary/30 hover:scale-[1.02] hover:shadow-xl' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => feature.available && navigate(feature.path)}
                disabled={!feature.available}
              >
                <div className="flex items-start justify-between gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 shadow-lg border border-primary/20"
                    style={{ background: `${feature.color}30` }}
                  >
                    <feature.icon size={32} strokeWidth={2} style={{ color: feature.color }} />
                  </div>
                  {!feature.available && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-accent-purple to-accent text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                      Soon
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-text-primary mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-base text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                {feature.available && (
                  <div className="text-2xl text-primary self-end opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                    →
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
              </button>
            ))}
          </div>
        </section>

        {/* User Info Card */}
        <section className="mt-auto pt-8">
          <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-gradient-to-r from-primary-dark via-primary to-accent flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-text-primary mb-1">
                {user?.user_metadata?.full_name || "User"}
              </div>
              <div className="text-sm text-text-secondary">{user?.email}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}