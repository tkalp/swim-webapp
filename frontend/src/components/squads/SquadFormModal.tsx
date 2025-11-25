// components/squads/SquadFormModal.tsx
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { CreateSquadData } from '@/services/squadService'

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
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Squad Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            placeholder="Enter squad name"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none"
            placeholder="Enter squad description (optional)"
            rows={3}
          />
        </div>

        <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <h4 className="text-sm font-semibold text-cyan-400 mb-2">
            What you can do with your squad:
          </h4>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-cyan-400" />
              <span>Add and manage swimmers</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-cyan-400" />
              <span>Track practice sessions</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-cyan-400" />
              <span>Monitor performance metrics</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-cyan-400" />
              <span>Schedule meets and events</span>
            </li>
          </ul>
        </div>

        {/* Form Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 text-slate-400 hover:text-white rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.name.trim()}
            className="group relative flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden"
          >
            <div className="absolute inset-0 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500" />
            <div className="absolute inset-0 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative">{loading ? 'Creating...' : 'Create Squad'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}