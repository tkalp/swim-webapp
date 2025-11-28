// components/squad/SquadSidebar.tsx
import { LayoutDashboard, Users, Calendar, UserCog, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { TabKey, TrainingSubTab } from '@/hooks/useSquadData';

interface SquadSidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const SIDEBAR_ITEMS: Array<{
  key: TabKey;
  icon: React.ElementType;
  label: string;
  description?: string;
}> = [
  { key: 'overview', icon: LayoutDashboard, label: 'Overview', description: 'Metrics, rankings & performance' },
  { key: 'team', icon: Users, label: 'Team', description: 'Swimmers & roster' },
  { key: 'training', icon: Calendar, label: 'Training', description: 'Schedule, sessions & calendar' },
  { key: 'schedule', icon: Calendar, label: 'Calendar', description: 'Calendar events & planning' },
  { key: 'coaches', icon: UserCog, label: 'Coaches', description: 'Manage squad access' },
];

export function SquadSidebar({ activeTab, onTabChange }: SquadSidebarProps) {
  return (
    <aside className="w-64 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800/60 shrink-0 hidden lg:flex lg:flex-col h-screen">
      <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
        <div className="mb-6 pb-4 border-b border-slate-800/40">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3">
            Squad Menu
          </h3>
        </div>
        
        {SIDEBAR_ITEMS.map(({ key, icon: Icon, label, description }) => {
          const isActive = activeTab === key;
          
          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`
                w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300
                ${isActive 
                  ? 'bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 text-white shadow-xl shadow-cyan-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 hover:border-slate-700/50 border border-transparent'
                }
                group relative overflow-hidden
              `}
            >
              {/* Hover gradient for inactive items */}
              {!isActive && (
                <div className="absolute inset-0 bg-linear-to-r from-cyan-500/0 via-blue-500/0 to-purple-500/0 group-hover:from-cyan-500/5 group-hover:via-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300 rounded-xl"></div>
              )}
              
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-lg shadow-white/50"></div>
              )}
              
              <div className={`
                p-2 rounded-lg shrink-0 transition-all duration-300 relative z-10
                ${isActive 
                  ? 'bg-white/20' 
                  : 'bg-slate-800/50 group-hover:bg-slate-700/50'
                }
              `}>
                <Icon 
                  size={18} 
                  className={`transition-all duration-300 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400 group-hover:scale-110'
                  }`}
                  strokeWidth={2.5}
                />
              </div>
              
              <div className="flex-1 text-left relative z-10">
                <div className={`font-semibold ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                  {label}
                </div>
                {description && (
                  <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-500 group-hover:text-slate-400'}`}>
                    {description}
                  </div>
                )}
              </div>
              
              {/* Active indicator dot */}
              {isActive && (
                <div className="w-2 h-2 rounded-full bg-white shadow-lg shadow-white/50 animate-pulse relative z-10"></div>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// Mobile bottom navigation
export function SquadMobileNav({ activeTab, onTabChange }: SquadSidebarProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/60 shadow-2xl">
        <nav className="flex items-center justify-around px-2 py-2 max-w-7xl mx-auto">
          {SIDEBAR_ITEMS.map(({ key, icon: Icon, label }) => {
            const isActive = activeTab === key;
            
            return (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={`
                  relative flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 min-w-0 flex-1
                  ${isActive 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                  }
                `}
              >
                {/* Active background */}
                {isActive && (
                  <div className="absolute inset-0 bg-linear-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30"></div>
                )}
                
                <Icon 
                  size={20} 
                  className={`shrink-0 relative z-10 transition-all duration-300 ${
                    isActive 
                      ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]' 
                      : 'group-hover:scale-110'
                  }`}
                  strokeWidth={2.5}
                />
                <span className={`text-[10px] font-semibold truncate w-full text-center relative z-10 ${
                  isActive ? 'text-white' : 'text-slate-500'
                }`}>
                  {label}
                </span>
                
                {/* Active dot indicator */}
                {isActive && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50 animate-pulse"></div>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
