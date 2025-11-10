// components/squads/SquadFormModal.tsx
import { useState } from 'react'
import Modal from '../ui/Modal'
import type { CreateSquadData } from '../../services/squadService'

type SquadFormData = {
  name: string
  description: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (squadData: CreateSquadData) => Promise<void>
}

export default function SquadFormModal({ isOpen, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<SquadFormData>({
    name: '',
    description: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setLoading(true)
    try {
      const squadData: CreateSquadData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null
      }
      
      await onSubmit(squadData)
      
      // Reset form and close modal
      setFormData({ name: '', description: '' })
      onClose()
    } catch (error) {
      console.error('Error creating squad:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ name: '', description: '' })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Squad"
      size="md"
    >
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
            autoFocus
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

        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <h4 className="text-sm font-medium text-text-primary mb-2">
            What you can do with your squad:
          </h4>
          <ul className="text-xs text-text-secondary space-y-1">
            <li>• Add and manage swimmers</li>
            <li>• Track practice sessions</li>
            <li>• Monitor performance metrics</li>
            <li>• Schedule meets and events</li>
          </ul>
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
            {loading ? 'Creating...' : 'Create Squad'}
          </button>
        </div>
      </form>
    </Modal>
  )
}