// components/squad/SwimmerModal.tsx
import { useState, useEffect } from 'react'
import DateInput from '../ui/DateInput'
import Modal from '../ui/Modal'
import type { Swimmer, CreateSwimmerData, UpdateSwimmerData } from '../../services/swimmerService'

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
  onSubmit: (swimmer: CreateSwimmerData | UpdateSwimmerData, swimmerId?: string) => Promise<void>
}

export default function SwimmerModal({ isOpen, mode, swimmer, squadId, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false)
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
        await onSubmit(swimmerData)
      } else if (swimmer) {
        await onSubmit(swimmerData, swimmer.id)
      }
      
      onClose()
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
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'add' ? 'Add New Swimmer' : 'Edit Swimmer'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            First Name *
          </label>
          <input
            type="text"
            required
            value={formData.first_name}
            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
            className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            placeholder="Enter first name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Last Name *
          </label>
          <input
            type="text"
            required
            value={formData.last_name}
            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
            className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Sex
          </label>
          <select
            value={formData.sex}
            onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value as any }))}
            className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            <option value="">Select sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
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
            disabled={loading || !formData.first_name.trim() || !formData.last_name.trim()}
            className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : mode === 'add' ? 'Add Swimmer' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}