import { useState, useEffect } from 'react';
import GlobalNav from './GlobalNav';
import { CommandPalette } from './CommandPalette';

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
    <div className="min-h-screen bg-background-primary">
      <GlobalNav onCommandPaletteOpen={() => setIsCommandPaletteOpen(true)} />
      <main>
        {children}
      </main>
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
