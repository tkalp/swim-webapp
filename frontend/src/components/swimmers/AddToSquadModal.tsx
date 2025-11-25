// components/swimmers/AddToSquadModal.tsx
import { useState, useEffect } from 'react'
import { Users, Check, Loader2, UserPlus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { getSquadsForCoach, type SquadCard } from '@/services/squadService'
import { useCurrentUser, useAllSquads } from '@/hooks/useStores'
import { useSquadStore } from '@/stores/squadStore'

type ExternalSwimmerData = {
  athlete_id: string
  name: string
  gender: string
  birth_year?: number
  nation?: string
  club?: string
}

type Props = {
  isOpen: boolean
  swimmer: ExternalSwimmerData
  onClose: () => void
  onSubmit: (squadId: string) => Promise<void>
}

export default function AddToSquadModal({ isOpen, swimmer, onClose, onSubmit }: Props) {
  const user = useCurrentUser()
  const [loading, setLoading] = useState(false)
  const loadingSquads = useSquadStore(state => state.loading)
  const squads = useAllSquads()
  const [selectedSquadId, setSelectedSquadId] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (isOpen && user?.id) {
      loadSquads()
    }
  }, [isOpen, user?.id])

  const loadSquads = async () => {
    if (!user?.id) return
    
    const { setLoading, setSquads, setError } = useSquadStore.getState()
    
    setLoading(true)
    try {
      const data = await getSquadsForCoach(user.id)
      setSquads(data)
      
      // Auto-select first squad if only one
      if (data.length === 1) {
        setSelectedSquadId(data[0].id)
      }
    } catch (err) {
      console.error('Error loading squads:', err)
      setError('Failed to load squads')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedSquadId) {
      setError('Please select a squad')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      await onSubmit(selectedSquadId)
      onClose()
    } catch (err) {
      console.error('Error adding swimmer to squad:', err)
      setError(err instanceof Error ? err.message : 'Failed to add swimmer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Add to Squad</h2>
            <p className="text-sm text-slate-400 mt-0.5">Choose a squad for this swimmer</p>
          </div>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Swimmer Info Card - More Modern */}
        <div className="relative overflow-hidden bg-linear-to-br from-cyan-500/5 to-blue-500/10 rounded-2xl p-5 border border-cyan-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-slate-100 mb-1">{swimmer.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  {swimmer.gender && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60"></span>
                      {swimmer.gender === 'M' ? 'Male' : 'Female'}
                    </span>
                  )}
                  {swimmer.birth_year && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60"></span>
                      Born {swimmer.birth_year}
                    </span>
                  )}
                  {swimmer.nation && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60"></span>
                      {swimmer.nation}
                    </span>
                  )}
                  {swimmer.club && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60"></span>
                      {swimmer.club}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Squad Selection */}
        <div>
          <label className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
            <span>Select Squad</span>
            {loadingSquads && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
          </label>
          
          {loadingSquads ? (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-cyan-400" />
              <p className="text-slate-400 text-sm">Loading your squads...</p>
            </div>
          ) : squads.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/40">
              <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-100 font-medium mb-1">No squads found</p>
              <p className="text-slate-400 text-sm">Create a squad first to add swimmers</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {squads.map((squad) => (
                <button
                  key={squad.id}
                  type="button"
                  onClick={() => setSelectedSquadId(squad.id)}
                  className={`group w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    selectedSquadId === squad.id
                      ? 'bg-cyan-500/10 border-cyan-500 shadow-lg shadow-cyan-500/10 scale-[1.02]'
                      : 'bg-slate-900/90 border-slate-800/40 hover:border-cyan-500/50 hover:shadow-md'
                  }`}
                >
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        selectedSquadId === squad.id
                          ? 'bg-cyan-500/20'
                          : 'bg-slate-800/60 group-hover:bg-cyan-500/10'
                      }`}>
                        <Users className={`w-5 h-5 transition-colors ${
                          selectedSquadId === squad.id ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-100 truncate">
                          {squad.name || 'Unnamed Squad'}
                        </div>
                        <div className="text-sm text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{squad.swimmers_count} {squad.swimmers_count === 1 ? 'swimmer' : 'swimmers'}</span>
                          {squad.role && (
                            <>
                              <span className="text-slate-500">•</span>
                              <span className="capitalize">{squad.role}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`shrink-0 transition-all duration-200 ${
                      selectedSquadId === squad.id ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                    }`}>
                      <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-5 py-3 text-slate-400 font-medium hover:text-slate-100 hover:bg-slate-800/50 rounded-xl transition-all"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !selectedSquadId || squads.length === 0}
            className="flex-1 px-5 py-3 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Add to Squad</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
