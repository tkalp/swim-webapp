interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled?: boolean;
}

const PRIMARY_ACTIONS = [
  { id: 'harder', label: 'Make Harder' },
  { id: 'easier', label: 'Make Easier' },
];

const SECONDARY_ACTIONS = [
  { id: 'add-kick', label: 'Add Kick' },
  { id: 'add-drill', label: 'Add Drill' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'lengthen', label: 'Lengthen' },
];

export function QuickActions({ onAction, disabled = false }: QuickActionsProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {PRIMARY_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={disabled}
            className="px-4 py-1.5 text-sm font-medium rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {SECONDARY_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            disabled={disabled}
            className="px-3 py-1 text-xs rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
