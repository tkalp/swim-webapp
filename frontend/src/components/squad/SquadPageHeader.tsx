// components/squad/SquadPageHeader.tsx
import React from 'react';

interface SquadPageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export function SquadPageHeader({ title, subtitle, actions }: SquadPageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-2">
            {title}
          </h1>
          <p className="text-text-secondary text-base">
            {subtitle}
          </p>
        </div>
        
        {actions && (
          <div className="flex flex-wrap gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
