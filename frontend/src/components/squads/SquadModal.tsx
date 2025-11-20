// components/squads/SquadModal.tsx
import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import type { Squad, UpdateSquadData } from '@/services/squadService'

type SquadFormData = {
  name: string
  description: string
}

type Props = {
  isOpen: boolean
  mode: 'edit' | 'delete'
  squad?: Squad | null
  onClose: () => void
  onSubmit: (updates?: UpdateSquadData, squadId?: string) => Promise<void>
}

export default function SquadModal({ isOpen, mode, squad, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<SquadFormData>(() => ({
    name: squad?.name || '',
    description: squad?.description || ''
  }))

  // Update form data when squad prop changes
  useEffect(() => {
    if (squad && mode === 'edit') {
      setFormData({
        name: squad.name || '',
        description: squad.description || ''
      })
    }
  }, [squad, mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!squad) return

    if (mode === 'edit' && !formData.name.trim()) return

    setLoading(true)
    try {
      if (mode === 'edit') {
        const updates: UpdateSquadData = {
          name: formData.name.trim(),
          description: formData.description.trim() || null
        }
        await onSubmit(updates, squad.id)
      } else if (mode === 'delete') {
        await onSubmit(undefined, squad.id)
      }
      
      onClose()
    } catch (error) {
      console.error('Error saving squad:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      description: ''
    })
    onClose()
  }

  if (!isOpen || !squad) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'edit' ? 'Edit Squad' : 'Delete Squad'}
      size="md"
    >
      {mode === 'edit' ? (
        /* Edit Form */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Squad Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              placeholder="Enter squad name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
              placeholder="Enter squad description (optional)"
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary rounded-lg font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        /* Delete Confirmation */
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/20 rounded-lg">
            <AlertTriangle size={20} className="text-danger shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                This action cannot be undone
              </p>
              <p className="text-xs text-text-secondary mt-1">
                All swimmers and data associated with this squad will be removed.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-text-secondary">
              You are about to delete:
            </p>
            <div className="p-3 bg-background-tertiary rounded-lg border border-border">
              <p className="font-medium text-text-primary">{squad.name || 'Untitled Squad'}</p>
              {squad.description && (
                <p className="text-sm text-text-secondary mt-1">{squad.description}</p>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary rounded-lg font-medium transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-danger hover:bg-danger/90 disabled:bg-danger/50 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting...' : 'Delete Squad'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}