import { useState, useEffect } from 'react';
import GlobalNav from '@/components/layout/GlobalNav';
import { CommandPalette } from '@/components/layout/CommandPalette';

interface GlobalLayoutProps {
  children: React.ReactNode;
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      // Cmd+P or Ctrl+P to open command palette (alternative)
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Skip Links for Keyboard Navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-6 focus:py-3 focus:bg-cyan-500 focus:text-white focus:font-semibold focus:rounded-xl focus:shadow-xl focus:ring-4 focus:ring-cyan-500/50"
      >
        Skip to main content
      </a>
      <a 
        href="#navigation" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-40 focus:z-50 focus:px-6 focus:py-3 focus:bg-cyan-500 focus:text-white focus:font-semibold focus:rounded-xl focus:shadow-xl focus:ring-4 focus:ring-cyan-500/50"
      >
        Skip to navigation
      </a>
      
      <GlobalNav onCommandPaletteOpen={() => setIsCommandPaletteOpen(true)} />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
