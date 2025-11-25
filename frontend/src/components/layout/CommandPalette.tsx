import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Users, 
  Dumbbell, 
  Sparkles, 
  Plus, 
  TrendingUp,
  Calendar,
  User,
  ArrowRight,
  Clock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: 'navigation' | 'create' | 'recent' | 'search';
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const commands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-home',
      label: 'Go to Home',
      icon: Sparkles,
      category: 'navigation',
      action: () => {
        navigate('/');
        onClose();
      },
      keywords: ['home', 'dashboard']
    },
    {
      id: 'nav-squads',
      label: 'Go to Squads',
      icon: Users,
      category: 'navigation',
      action: () => {
        navigate('/squads');
        onClose();
      },
      keywords: ['squads', 'teams']
    },
    {
      id: 'nav-workouts',
      label: 'Go to Workouts',
      icon: Dumbbell,
      category: 'navigation',
      action: () => {
        navigate('/workouts');
        onClose();
      },
      keywords: ['workouts', 'training', 'library']
    },
    {
      id: 'nav-ai-coach',
      label: 'Go to AI Coach',
      icon: Sparkles,
      category: 'navigation',
      action: () => {
        navigate('/ai-coach');
        onClose();
      },
      keywords: ['ai', 'coach', 'generate']
    },
    // Create actions
    {
      id: 'create-workout',
      label: 'Create New Workout',
      description: 'Build a custom workout',
      icon: Plus,
      category: 'create',
      action: () => {
        navigate('/workouts/create');
        onClose();
      },
      keywords: ['create', 'new', 'workout', 'add']
    },
    {
      id: 'create-squad',
      label: 'Create New Squad',
      description: 'Add a new squad',
      icon: Plus,
      category: 'create',
      action: () => {
        navigate('/squads/new');
        onClose();
      },
      keywords: ['create', 'new', 'squad', 'team', 'add']
    },
    {
      id: 'generate-workout',
      label: 'Generate Workout with AI',
      description: 'Use AI to create a workout',
      icon: Sparkles,
      category: 'create',
      action: () => {
        navigate('/ai-coach');
        onClose();
      },
      keywords: ['ai', 'generate', 'create', 'workout', 'assistant']
    },
  ], [navigate, onClose]);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    
    const searchLower = search.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some(k => k.includes(searchLower))
    );
  }, [search, commands]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredCommands[selectedIndex]?.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  const categoryLabels = {
    navigation: 'Navigation',
    create: 'Create',
    recent: 'Recent'
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-200 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-2xl z-201 px-4 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800/40">
            <Search size={20} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commands or type to filter..."
              className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-500 text-base"
            />
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-slate-500 bg-slate-800/60 rounded border border-slate-700/40 font-mono">
              ESC
            </kbd>
          </div>

          {/* Commands List */}
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {filteredCommands.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500">
                <p className="text-sm">No commands found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            )}

            {Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} className="mb-4 last:mb-0">
                <div className="px-4 py-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </h3>
                </div>
                <div className="space-y-1 px-2">
                  {cmds.map((cmd, idx) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <button
                        key={cmd.id}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-300
                          ${isSelected 
                            ? 'bg-cyan-500/10 border border-cyan-500/30' 
                            : 'border border-transparent hover:bg-slate-800/60'
                          }
                        `}
                      >
                        <div className={`
                          p-2 rounded-lg shrink-0 transition-colors
                          ${isSelected ? 'bg-cyan-500/20' : 'bg-slate-800/60'}
                        `}>
                          <Icon size={16} className={isSelected ? 'text-cyan-400' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-100">
                            {cmd.label}
                          </div>
                          {cmd.description && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight size={16} className="text-cyan-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800/40 px-4 py-3 bg-slate-800/30">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-slate-900/95 rounded border border-slate-700/40 font-mono">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-slate-900/95 rounded border border-slate-700/40 font-mono">↵</kbd>
                  Select
                </span>
              </div>
              <span className="hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 bg-slate-900/95 rounded border border-slate-700/40 font-mono">Cmd+K</kbd> to open
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
