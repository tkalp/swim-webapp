// components/squad/SwimmersGrid.tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, User, Plus, Edit2, Trash2 } from 'lucide-react'
import SwimmerModal from '@/components/squad/SwimmerModal'
import type { Swimmer, CreateSwimmerData, UpdateSwimmerData } from '@/services/swimmerService'

type Props = {
  swimmers: Swimmer[]
  squadId: string
  canManage: boolean
  onAddSwimmer: (swimmer: CreateSwimmerData) => Promise<Swimmer>
  onEditSwimmer: (id: string, swimmer: UpdateSwimmerData) => Promise<void>
  onDeleteSwimmer: (id: string) => Promise<void>
}

export default function SwimmersGrid({ swimmers, squadId, canManage, onAddSwimmer, onEditSwimmer, onDeleteSwimmer }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sortBy, setSortBy] = useState<'last' | 'first' | 'dob'>('last')
  
  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingSwimmer, setEditingSwimmer] = useState<Swimmer | null>(null)

  const items = useMemo(() => {
    const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().trim()
    let filtered = swimmers.filter(s => {
      const full = `${norm(s.first_name)} ${norm(s.last_name)}`
      return full.includes(q.toLowerCase().trim())
    })
    filtered.sort((a, b) => {
      if (sortBy === 'last') return (a.last_name ?? '').localeCompare(b.last_name ?? '')
      if (sortBy === 'first') return (a.first_name ?? '').localeCompare(b.first_name ?? '')
      // dob: newest first
      const da = a.date_of_birth ? new Date(a.date_of_birth).getTime() : 0
      const db = b.date_of_birth ? new Date(b.date_of_birth).getTime() : 0
      return db - da
    })
    return filtered
  }, [swimmers, q, sortBy])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setEditingSwimmer(null)
    setShowModal(true)
  }

  const handleOpenEditModal = (swimmer: Swimmer) => {
    setModalMode('edit')
    setEditingSwimmer(swimmer)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingSwimmer(null)
  }

  const handleModalSubmit = async (swimmerData: CreateSwimmerData | UpdateSwimmerData, swimmerId?: string) => {
    if (modalMode === 'add') {
      const newSwimmer = await onAddSwimmer(swimmerData as CreateSwimmerData)
      return newSwimmer
    } else if (swimmerId) {
      await onEditSwimmer(swimmerId, swimmerData as UpdateSwimmerData)
    }
  }

  const handleDelete = async (swimmer: Swimmer) => {
    if (!confirm(`Are you sure you want to delete ${formatName(swimmer.first_name, swimmer.last_name)}?`)) {
      return
    }

    try {
      await onDeleteSwimmer(swimmer.id)
    } catch (error) {
      console.error('Error deleting swimmer:', error)
    }
  }

  if (!swimmers.length) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-24 px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary mb-6">
            <User size={40} />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Swimmers Yet</h3>
          <p className="text-text-secondary mb-8 max-w-md text-center">
            Get started by adding your first swimmer to this squad.
          </p>
          {canManage && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
            >
              <Plus size={18} />
              Add First Swimmer
            </button>
          )}
        </div>

        <SwimmerModal
          isOpen={showModal}
          mode={modalMode}
          swimmer={editingSwimmer}
          squadId={squadId}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
        />
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Toolbar */}
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 mb-8 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-muted" />
              <input
                className="w-full pl-11 pr-4 py-3 bg-background-tertiary/80 border border-border/50 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all hover:border-border"
                placeholder="Search by name..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          
          {/* Sort and Add */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              id="sortBy"
              className="px-4 py-3 bg-background-tertiary/80 border border-border/50 rounded-xl text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all hover:border-border cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="last">Sort by Last name</option>
              <option value="first">Sort by First name</option>
              <option value="dob">Sort by Age</option>
            </select>
            
            {canManage && (
              <button
                onClick={handleOpenAddModal}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/25 whitespace-nowrap"
              >
                <Plus size={18} />
                Add Swimmer
              </button>
            )}
          </div>
        </div>
        
        {/* Results Count */}
        {q && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-sm text-text-secondary">
              Found <span className="font-semibold text-primary">{items.length}</span> swimmer{items.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>

      {/* Swimmers List */}
      <div className="flex flex-col gap-4">
        {items.map((s, index) => {
          const initials = getInitials(s.first_name, s.last_name)
          const age = s.date_of_birth ? calcAge(s.date_of_birth) : null

          return (
            <div 
              key={s.id} 
              className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-5 sm:p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group animate-in fade-in slide-in-from-bottom"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Avatar and Info */}
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <div className="relative">
                    <div className="w-16 h-16 bg-linear-to-br from-primary/30 via-primary/40 to-accent/30 rounded-xl flex items-center justify-center text-primary font-bold text-xl border-2 border-primary/40 shadow-lg group-hover:scale-105 transition-transform duration-300">
                      {initials}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-text-primary text-lg mb-2 truncate">
                      {formatName(s.first_name, s.last_name)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {age !== null && (
                        <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-primary/30 to-accent/30 border border-primary/50 text-primary text-xs font-semibold rounded-lg">
                          Age {age}
                        </span>
                      )}
                      {s.sex && (
                        <span className="inline-flex items-center px-2.5 py-1 bg-background-tertiary border border-border/60 text-text-primary text-xs font-medium rounded-lg">
                          {s.sex}
                        </span>
                      )}
                      {s.date_of_birth && (
                        <span className="text-xs text-text-muted">
                          Born {new Date(s.date_of_birth).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => navigate(`/swimmers/${s.id}`)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-linear-to-r from-primary to-accent text-white rounded-lg font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
                    title="View swimmer details"
                  >
                    Open
                    <ChevronRight size={16} />
                  </button>
                  {canManage && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(s)}
                        className="p-3 bg-background-tertiary border border-border/50 hover:border-accent/50 hover:bg-accent/10 text-text-muted hover:text-accent rounded-lg transition-all duration-200 hover:scale-105"
                        title="Edit swimmer"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-3 bg-background-tertiary border border-border/50 hover:border-danger/50 hover:bg-danger/10 text-text-muted hover:text-danger rounded-lg transition-all duration-200 hover:scale-105"
                        title="Delete swimmer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* No Results */}
      {q && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary mb-6">
            <Search size={40} />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Results Found</h3>
          <p className="text-text-secondary max-w-md text-center">
            No swimmers match your search for "<span className="font-semibold text-primary">{q}</span>"
          </p>
        </div>
      )}

      <SwimmerModal
        isOpen={showModal}
        mode={modalMode}
        swimmer={editingSwimmer}
        squadId={squadId}
        onClose={handleCloseModal}
        onSubmit={handleModalSubmit}
      />
    </div>
  )
}

/* ----- Helpers ----- */
function getInitials(first?: string | null, last?: string | null) {
  const a = (first ?? '').trim()
  const b = (last ?? '').trim()
  if (!a && !b) return '??'
  if (!b) return a.slice(0, 2).toUpperCase()
  return (a[0] + b[0]).toUpperCase()
}

function formatName(first?: string | null, last?: string | null) {
  const f = (first ?? '').trim()
  const l = (last ?? '').trim()
  if (!f && !l) return 'Unnamed'
  return `${l}${l && f ? ', ' : ''}${f}`
}

function calcAge(dobISO: string) {
  const dob = new Date(dobISO)
  if (isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}