import { useState, useRef, useEffect } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

type Swimmer = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  sex: string
  squad_id: string
}

type Squad = {
  id: string
  name: string
}

type SwimmerSelectProps = {
  swimmers: Swimmer[]
  squads: Squad[]
  value: string
  onChange: (swimmerId: string) => void
  label: string
  color: 'blue' | 'purple'
  disabled?: boolean
  placeholder?: string
}

export default function SwimmerSelect({
  swimmers,
  squads,
  value,
  onChange,
  label,
  color,
  disabled,
  placeholder = 'Search swimmers...'
}: SwimmerSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedSwimmer = swimmers.find(s => s.id === value)

  const getSwimmerLabel = (swimmer: Swimmer) => {
    const squad = squads.find(s => s.id === swimmer.squad_id)
    return `${swimmer.first_name} ${swimmer.last_name}${squad ? ` (${squad.name})` : ''}`
  }

  const filteredSwimmers = swimmers.filter(swimmer => {
    if (!searchQuery) return true
    const label = getSwimmerLabel(swimmer).toLowerCase()
    return label.includes(searchQuery.toLowerCase())
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (swimmerId: string) => {
    onChange(swimmerId)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearchQuery('')
  }

  const colorClasses = {
    blue: {
      ring: 'focus:ring-blue-500/50 focus:border-blue-500/50',
      border: 'border-blue-500/30',
      bg: 'bg-blue-400',
      shadow: 'shadow-blue-400/50',
      hover: 'hover:border-blue-500/30',
      text: 'text-blue-400',
      bgHover: 'hover:bg-blue-500/10'
    },
    purple: {
      ring: 'focus:ring-purple-500/50 focus:border-purple-500/50',
      border: 'border-purple-500/30',
      bg: 'bg-purple-400',
      shadow: 'shadow-purple-400/50',
      hover: 'hover:border-purple-500/30',
      text: 'text-purple-400',
      bgHover: 'hover:bg-purple-500/10'
    }
  }

  const classes = colorClasses[color]

  return (
    <div className="group" ref={containerRef}>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
        <div className={`w-2 h-2 rounded-full ${classes.bg} shadow-lg ${classes.shadow}`} />
        {label}
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl 
            text-slate-200 text-left flex items-center justify-between gap-2
            focus:outline-none focus:ring-2 ${classes.ring}
            transition-all backdrop-blur-sm ${classes.hover}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isOpen ? `ring-2 ${classes.ring}` : ''}
          `}
        >
          <span className={selectedSwimmer ? 'text-slate-200' : 'text-slate-500'}>
            {selectedSwimmer ? getSwimmerLabel(selectedSwimmer) : placeholder}
          </span>
          <div className="flex items-center gap-2">
            {selectedSwimmer && !disabled && (
              <X
                className="w-4 h-4 text-slate-400 hover:text-slate-200 transition-colors"
                onClick={handleClear}
              />
            )}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredSwimmers.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  No swimmers found
                </div>
              ) : (
                <div className="py-1">
                  {filteredSwimmers.map((swimmer) => {
                    const isSelected = swimmer.id === value
                    return (
                      <button
                        key={swimmer.id}
                        type="button"
                        onClick={() => handleSelect(swimmer.id)}
                        className={`
                          w-full px-4 py-2.5 text-left text-sm transition-colors
                          ${isSelected 
                            ? `${classes.text} bg-slate-700/50 font-medium` 
                            : 'text-slate-300 hover:bg-slate-700/30'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className={isSelected ? classes.text : 'text-slate-200'}>
                              {swimmer.first_name} {swimmer.last_name}
                            </div>
                            {squads.find(s => s.id === swimmer.squad_id) && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {squads.find(s => s.id === swimmer.squad_id)?.name}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <div className={`w-1.5 h-1.5 rounded-full ${classes.bg}`} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
