// components/squad/SquadTabHeader.tsx
import { ReactNode } from 'react';

interface SquadTabHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function SquadTabHeader({ title, subtitle, actions }: SquadTabHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-400 text-sm mt-1 font-medium">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

