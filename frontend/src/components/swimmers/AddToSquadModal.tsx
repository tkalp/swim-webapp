// components/swimmers/AddToSquadModal.tsx
import { useState, useEffect } from 'react'
import { Users, Check } from 'lucide-react'
import Modal from '../ui/Modal'
import { getSquadsForCoach, type SquadCard } from '../../services/squadService'
import { useAuth } from '../../contexts/AuthContext'

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
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [squads, setSquads] = useState<SquadCard[]>([])
  const [selectedSquadId, setSelectedSquadId] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (isOpen && user?.id) {
      loadSquads()
    }
  }, [isOpen, user?.id])

  const loadSquads = async () => {
    if (!user?.id) return
    
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
      title="Add to Squad"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Swimmer Info */}
        <div className="bg-background-secondary/50 rounded-xl p-4 border border-border/40">
          <h3 className="font-semibold text-text-primary mb-2">Swimmer</h3>
          <p className="text-text-primary">{swimmer.name}</p>
          <div className="flex gap-4 mt-2 text-sm text-text-secondary">
            {swimmer.birth_year && <span>Born {swimmer.birth_year}</span>}
            {swimmer.nation && <span>{swimmer.nation}</span>}
            {swimmer.club && <span>{swimmer.club}</span>}
          </div>
        </div>

        {/* Squad Selection */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Select Squad
          </label>
          
          {squads.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No squads found. Create a squad first.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {squads.map((squad) => (
                <button
                  key={squad.id}
                  type="button"
                  onClick={() => setSelectedSquadId(squad.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedSquadId === squad.id
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-background-elevated border-border/40 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text-primary">
                        {squad.name || 'Unnamed Squad'}
                      </div>
                      <div className="text-sm text-text-secondary mt-1">
                        {squad.swimmers_count} {squad.swimmers_count === 1 ? 'swimmer' : 'swimmers'}
                        {squad.role && ` • ${squad.role}`}
                      </div>
                    </div>
                    {selectedSquadId === squad.id && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-text-secondary hover:text-text-primary hover:bg-background-secondary rounded-xl transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !selectedSquadId || squads.length === 0}
            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Adding...' : 'Add to Squad'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
