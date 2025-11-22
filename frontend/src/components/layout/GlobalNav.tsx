// components/layout/GlobalNav.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Users, Dumbbell, Sparkles, Plus, Search, LogOut, User, Settings, Network, Home, Shield } from "lucide-react";
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
      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 group ${
        isActive
          ? "bg-linear-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 scale-105"
          : "text-text-secondary hover:text-text-primary hover:bg-primary/10 hover:scale-[1.02] border border-transparent hover:border-primary/20"
      }`}
    >
      <Icon size={18} className={`transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
      <span className="hidden md:inline">{children}</span>
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-white rounded-full shadow-lg" />
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
        className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-primary to-accent text-white rounded-xl font-bold text-sm hover:scale-105 transition-all duration-200 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
        title="Quick Create"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span className="hidden lg:inline">New</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-background-elevated border border-border/60 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => handleAction("/workouts/create")}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-text-primary hover:bg-background-secondary/80 transition-colors"
          >
            <Dumbbell size={16} className="text-primary" />
            <span className="text-sm font-medium">New Workout</span>
          </button>
          <button
            onClick={() => handleAction("/squads/new")}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-text-primary hover:bg-background-secondary/80 transition-colors"
          >
            <Users size={16} className="text-primary" />
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
        className="w-10 h-10 rounded-full bg-linear-to-r from-primary-dark via-primary to-accent flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/30 hover:scale-110 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200 ring-2 ring-primary/20"
        title={userName}
      >
        {userInitial}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-background-elevated border border-border/60 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-border/40">
            <p className="text-sm font-semibold text-text-primary truncate">{userName}</p>
            <p className="text-xs text-text-secondary truncate">{user?.email}</p>
          </div>
          
          <div className="py-2">
            <button
              onClick={() => {
                navigate("/");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-text-primary hover:bg-background-secondary/80 transition-colors"
            >
              <Home size={16} className="text-primary" />
              <span className="text-sm font-medium">Home</span>
            </button>
            
            {isAdmin && (
              <button
                onClick={() => {
                  navigate("/admin/sync");
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-text-primary hover:bg-background-secondary/80 transition-colors"
              >
                <Shield size={16} className="text-orange-500" />
                <span className="text-sm font-medium">Admin Sync</span>
              </button>
            )}
            
            <div className="my-2 border-t border-border/40"></div>
            
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-danger hover:bg-danger/10 transition-colors"
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
    <header className="sticky top-0 z-100 bg-background-elevated/95 backdrop-blur-xl border-b border-border/60 shadow-xl">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:scale-105 transition-transform duration-200 group"
          >
            <img src={logo} alt="Aquilus" className="h-12 w-auto object-contain" />
            <span className="text-xl font-bold bg-linear-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent drop-shadow-sm">
              aquilus
            </span>
          </Link>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center gap-3">
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
          <div className="flex items-center gap-3">
            {/* Swimmer Search */}
            <SwimmerSearchBar />
            <NotificationBell />
            <QuickCreateMenu />
            <ProfileMenu />
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-3 pb-3 overflow-x-auto">
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
      </div>
    </header>
  );
}
