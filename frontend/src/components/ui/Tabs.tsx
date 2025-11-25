type TabsProps<T extends string> = {
  active: T
  onChange: (t: T) => void
  items: readonly T[]
  labelize?: (t: T) => string
}

export function Tabs<T extends string>({ active, onChange, items, labelize }: TabsProps<T>) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-800/60 shadow-lg">
      {items.map(t => {
        const isActive = active === t
        const label = labelize ? labelize(t) : t[0].toUpperCase() + t.slice(1)
        
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`
              relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300
              ${isActive 
                ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white shadow-lg shadow-cyan-500/30 scale-[1.02]' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }
            `}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-lg blur-xl -z-10"></div>
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}