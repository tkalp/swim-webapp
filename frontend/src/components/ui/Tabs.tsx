type TabsProps<T extends string> = {
  active: T
  onChange: (t: T) => void
  items: readonly T[]
  labelize?: (t: T) => string
}

export function Tabs<T extends string>({ active, onChange, items, labelize }: TabsProps<T>) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-background-elevated/80 backdrop-blur-sm rounded-xl border border-border/60 shadow-lg">
      {items.map(t => {
        const isActive = active === t
        const label = labelize ? labelize(t) : t[0].toUpperCase() + t.slice(1)
        
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`
              relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
              ${isActive 
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/30 scale-[1.02]' 
                : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/50'
              }
            `}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg blur-xl -z-10"></div>
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}