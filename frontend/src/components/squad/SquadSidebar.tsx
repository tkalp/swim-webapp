// components/squad/SquadSidebar.tsx
import { LayoutDashboard, Users, Calendar, Dumbbell, UserCog, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { TabKey, TrainingSubTab } from '../../hooks/useSquadData';

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
  { key: 'workouts', icon: Dumbbell, label: 'Workouts', description: 'Workout library' },
  { key: 'coaches', icon: UserCog, label: 'Coaches', description: 'Manage squad access' },
];

export function SquadSidebar({ activeTab, onTabChange }: SquadSidebarProps) {
  return (
    <aside className="w-64 bg-linear-to-b from-background-elevated to-background-secondary/30 border-r border-border/60 shrink-0 hidden lg:block backdrop-blur-sm">
      <nav className="sticky top-0 p-6 space-y-1.5">
        <div className="mb-6 pb-4 border-b border-border/40">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-3">
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
                w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200
                ${isActive 
                  ? 'bg-linear-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 scale-105' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-background-card/80 hover:shadow-md hover:scale-[1.02]'
                }
                group relative overflow-hidden
              `}
            >
              {/* Background glow for active item */}
              {isActive && (
                <>
                  <div className="absolute inset-0 bg-linear-to-r from-primary/20 to-accent/20 rounded-xl blur-lg"></div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-lg shadow-white/50"></div>
                </>
              )}
              
              <div className={`
                p-1.5 rounded-lg shrink-0 transition-all duration-200
                ${isActive 
                  ? 'bg-white/20 shadow-inner' 
                  : 'bg-background-tertiary/50 group-hover:bg-primary/10'
                }
              `}>
                <Icon 
                  size={18} 
                  className={`transition-transform duration-200 ${
                    isActive ? '' : 'group-hover:scale-110'
                  }`}
                  strokeWidth={2.5}
                />
              </div>
              
              <div className="flex-1 text-left relative z-10">
                <div className="font-semibold">{label}</div>
                {description && (
                  <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white/80' : 'text-text-muted'}`}>
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background-elevated/95 backdrop-blur-xl border-t border-border shadow-2xl">
        <nav className="flex items-center justify-around px-2 py-2 max-w-7xl mx-auto">
          {SIDEBAR_ITEMS.map(({ key, icon: Icon, label }) => {
            const isActive = activeTab === key;
            
            return (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={`
                  flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1
                  ${isActive 
                    ? 'text-primary' 
                    : 'text-text-secondary'
                  }
                `}
              >
                <Icon 
                  size={20} 
                  className={`shrink-0 ${isActive ? 'drop-shadow-[0_0_8px_rgba(49,151,167,0.6)]' : ''}`}
                />
                <span className={`text-[10px] font-medium truncate w-full text-center ${
                  isActive ? 'text-primary' : 'text-text-muted'
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
