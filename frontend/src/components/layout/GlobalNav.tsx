// components/layout/GlobalNav.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Users, Dumbbell, Sparkles, Plus, Search, LogOut, User, Settings, Network, Home, Shield, Calendar } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useEffect } from "react";
import { NotificationBell } from '@/components/layout/NotificationBell';
import { SwimmerSearchBar } from '@/components/swimmers/SwimmerSearchBar';
import logo from '@/assets/logo.png';

interface NavLinkProps {
  to: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function NavLink({ to, icon: Icon, children }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to) && to !== "/" || location.pathname === to;

  return (
    <Link
      to={to}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 group ${
        isActive
          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
      }`}
    >
      <Icon size={18} className={`transition-all duration-200 ${isActive ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`} strokeWidth={2} />
      <span className="hidden lg:inline">{children}</span>
      {isActive && (
        <div className="absolute inset-0 bg-linear-to-r from-cyan-500/5 to-blue-500/5 rounded-lg -z-10" />
      )}
    </Link>
  );
}

function QuickCreateMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200"
        title="Quick Create"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span className="hidden sm:inline">Create</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => handleAction("/workouts/create")}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors rounded-lg mx-1"
          >
            <Dumbbell size={16} className="text-cyan-400" />
            <span className="text-sm font-medium">New Workout</span>
          </button>
          <button
            onClick={() => handleAction("/squads/new")}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors rounded-lg mx-1"
          >
            <Users size={16} className="text-cyan-400" />
            <span className="text-sm font-medium">New Squad</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const userName = user?.user_metadata?.full_name || user?.email || "User";
  const userInitial = userName[0]?.toUpperCase() || "U";
  const isAdmin = user?.email === 'teddy.kalp@lablytics.com';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm hover:bg-linear-to-br hover:from-cyan-500/30 hover:to-blue-500/30 hover:border-cyan-500/50 transition-all duration-200"
        title={userName}
      >
        {userInitial}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="text-sm font-semibold text-slate-200 truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          
          <div className="py-1">
            <button
              onClick={() => {
                navigate("/");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors rounded-lg mx-1"
            >
              <Home size={16} className="text-cyan-400" />
              <span className="text-sm font-medium">Home</span>
            </button>
            
            {isAdmin && (
              <button
                onClick={() => {
                  navigate("/admin/sync");
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-slate-200 hover:bg-orange-500/10 hover:text-orange-400 transition-colors rounded-lg mx-1"
              >
                <Shield size={16} className="text-orange-400" />
                <span className="text-sm font-medium">Admin Sync</span>
              </button>
            )}
            
            <div className="my-1 mx-3 border-t border-slate-700/50"></div>
            
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors rounded-lg mx-1"
            >
              <LogOut size={16} />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface GlobalNavProps {
  onCommandPaletteOpen?: () => void;
}

export default function GlobalNav({ onCommandPaletteOpen }: GlobalNavProps) {
  return (
    <header className="sticky top-0 z-100 bg-slate-950/80 backdrop-blur-2xl border-b border-slate-800/50 shadow-2xl">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity duration-200 group"
          >
            <span className="text-lg sm:text-xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              aquilus
            </span>
          </Link>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/squads" icon={Users}>
              Squads
            </NavLink>
            <NavLink to="/workouts" icon={Dumbbell}>
              Workouts
            </NavLink>
            <NavLink to="/network" icon={Network}>
              Network
            </NavLink>
            <NavLink to="/ai-coach" icon={Sparkles}>
              AI Coach
            </NavLink>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Swimmer Search */}
            <SwimmerSearchBar />
            <NotificationBell />
            <QuickCreateMenu />
            <ProfileMenu />
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-none">
          <NavLink to="/squads" icon={Users}>
            Squads
          </NavLink>
          <NavLink to="/workouts" icon={Dumbbell}>
            Workouts
          </NavLink>
          <NavLink to="/calendar" icon={Calendar}>
            Calendar
          </NavLink>
          <NavLink to="/network" icon={Network}>
            Network
          </NavLink>
          <NavLink to="/ai-coach" icon={Sparkles}>
            AI Coach
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
