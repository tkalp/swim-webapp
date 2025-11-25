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
              className="group relative flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500" />
              <div className="absolute inset-0 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative">{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Delete Confirmation */
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-400" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                This action cannot be undone
              </p>
              <p className="text-xs text-slate-400 mt-1">
                All swimmers and data associated with this squad will be removed.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-400">
              You are about to delete:
            </p>
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <p className="font-semibold text-white">{squad.name || 'Untitled Squad'}</p>
              {squad.description && (
                <p className="text-sm text-slate-400 mt-1">{squad.description}</p>
              )}
            </div>
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
              onClick={handleSubmit}
              disabled={loading}
              className="group relative flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-linear-to-r from-red-500 to-red-600" />
              <div className="absolute inset-0 bg-linear-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative">{loading ? 'Deleting...' : 'Delete Squad'}</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}