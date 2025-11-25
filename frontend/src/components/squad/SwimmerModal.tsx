// components/squad/SwimmerModal.tsx
import { useState, useEffect } from 'react'
import DateInput from '@/components/ui/DateInput'
import Modal from '@/components/ui/Modal'
import SwimRankingsLink from '@/components/swimmers/SwimRankingsLink'
import { useToast } from '@/contexts/ToastContext'
import type { Swimmer, CreateSwimmerData, UpdateSwimmerData } from '@/services/swimmerService'

type SwimmerFormData = {
  first_name: string
  last_name: string
  date_of_birth: string
  sex: 'Male' | 'Female' | 'Other' | ''
}

type Props = {
  isOpen: boolean
  mode: 'add' | 'edit'
  swimmer?: Swimmer | null
  squadId: string
  onClose: () => void
  onSubmit: (swimmer: CreateSwimmerData | UpdateSwimmerData, swimmerId?: string) => Promise<Swimmer | undefined | void>
}

export default function SwimmerModal({ isOpen, mode, swimmer, squadId, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false)
  const [showTracking, setShowTracking] = useState(false)
  const [createdSwimmerId, setCreatedSwimmerId] = useState<string | null>(null)
  const { showToast } = useToast()
  const [formData, setFormData] = useState<SwimmerFormData>(() => ({
    first_name: swimmer?.first_name || '',
    last_name: swimmer?.last_name || '',
    date_of_birth: swimmer?.date_of_birth || '',
    sex: swimmer?.sex || ''
  }))

  // Update form data when swimmer prop changes
  useEffect(() => {
    if (swimmer && mode === 'edit') {
      setFormData({
        first_name: swimmer.first_name || '',
        last_name: swimmer.last_name || '',
        date_of_birth: swimmer.date_of_birth || '',
        sex: swimmer.sex || ''
      })
    } else if (mode === 'add') {
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        sex: ''
      })
    }
  }, [swimmer, mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.first_name.trim() || !formData.last_name.trim()) return

    setLoading(true)
    try {
      const swimmerData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth || null,
        sex: formData.sex || null,
        squad_id: squadId
      }

      if (mode === 'add') {
        const result = await onSubmit(swimmerData)
        // Show success toast
        showToast(`${formData.first_name} ${formData.last_name} added successfully!`, 'success')
        // Close modal immediately after creating swimmer
        // Users can add tracking from the swimmer's detail page
        onClose()
      } else if (swimmer) {
        await onSubmit(swimmerData, swimmer.id)
        showToast('Swimmer updated successfully!', 'success')
        onClose()
      }
    } catch (error) {
      console.error('Error saving swimmer:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      sex: ''
    })
    setShowTracking(false)
    setCreatedSwimmerId(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={showTracking ? 'Track Swimmer (Optional)' : mode === 'add' ? 'Add New Swimmer' : 'Edit Swimmer'}
      size="md"
    >
      {!showTracking ? (
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            First Name *
          </label>
          <input
            type="text"
            required
            value={formData.first_name}
            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            placeholder="Enter first name"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Last Name *
          </label>
          <input
            type="text"
            required
            value={formData.last_name}
            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
            placeholder="Enter last name"
          />
        </div>

        <div>
          <DateInput
            label="Date of Birth"
            value={formData.date_of_birth}
            onChange={(value) => setFormData(prev => ({ ...prev, date_of_birth: value }))}
            placeholder="Select date of birth"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Sex
          </label>
          <select
            value={formData.sex}
            onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value as any }))}
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
          >
            <option value="" className="bg-slate-800 text-slate-400">Select sex</option>
            <option value="Male" className="bg-slate-800">Male</option>
            <option value="Female" className="bg-slate-800">Female</option>
            <option value="Other" className="bg-slate-800">Other</option>
          </select>
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
            disabled={loading || !formData.first_name.trim() || !formData.last_name.trim()}
            className="group relative flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500" />
            <div className="absolute inset-0 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative">{loading ? 'Saving...' : mode === 'add' ? 'Add Swimmer' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
      ) : (
        <div className="space-y-5">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-300">
                Swimmer created successfully! You can now optionally track this swimmer to sync their competition results.
              </p>
            </div>
          </div>

          {createdSwimmerId && (
            <SwimRankingsLink
              swimmerId={createdSwimmerId}
              firstName={formData.first_name}
              lastName={formData.last_name}
            />
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="group relative flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] overflow-hidden"
            >
              <div className="absolute inset-0 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500" />
              <div className="absolute inset-0 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative">Done</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}