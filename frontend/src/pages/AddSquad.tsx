// pages/AddSquadPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { FormCard, FormField, TextInput, TextArea, FormActions } from '@/components/form'
import { ArrowLeft, Users } from 'lucide-react'

export default function AddSquadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const coachId = user?.id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!coachId) return setError('You must be signed in to create a squad')
    if (!name.trim()) return setError('Please enter a squad name')

    setLoading(true)
    try {
      // Create squad row
      const { data: squadData, error: createErr } = await supabase
        .from('squads')
        .insert({ name: name.trim(), description: description.trim(), coach_id: coachId })
        .select('id')
        .limit(1)
        .single()

      if (createErr || !squadData) throw createErr ?? new Error('Failed to create squad')

      // Navigate to the newly created squad page
      navigate(`/squads`)
    } catch (err: any) {
      setError(err?.message || 'Failed to create squad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-100 bg-background-card backdrop-blur-[10px] border-b border-border">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Back Button */}
            <button
              className="flex items-center gap-2 text-text-secondary bg-transparent border-none font-medium cursor-pointer transition-all px-3 py-2 rounded-lg hover:text-primary-light hover:bg-[rgba(14,165,233,0.1)]"
              onClick={() => navigate('/squads')}
            >
              <ArrowLeft size={18} />
              <span className="hidden sm:inline">Back to Squads</span>
              <span className="sm:hidden">Back</span>
            </button>

            {/* Title */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[rgba(49,151,167,0.2)] to-[rgba(34,211,238,0.2)] flex items-center justify-center">
                <Users size={20} className="text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold m-0 bg-linear-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
                Create Squad
              </h1>
            </div>

            {/* Spacer for alignment */}
            <div className="w-[100px] hidden sm:block" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <FormCard title="Squad Details">
          <form onSubmit={handleSubmit}>
            <FormField label="Squad Name" required>
              <TextInput
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="E.g. Junior Sharks"
                disabled={loading}
                required
              />
            </FormField>

            <FormField label="Description" hint="Optional - Add a short description for your squad">
              <TextArea
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Short description for your squad"
                rows={4}
                disabled={loading}
              />
            </FormField>

            {error && (
              <div className="bg-background-elevated border border-danger rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <strong className="block text-danger text-sm font-semibold mb-1">
                      Error
                    </strong>
                    <p className="m-0 text-text-secondary text-sm leading-relaxed">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <FormActions>
              <button
                type="button"
                className="flex-1 sm:flex-none px-6 py-2.5 bg-background-tertiary text-text-secondary border border-border rounded-lg font-medium text-sm cursor-pointer transition-all hover:bg-[var(--color-background-secondary)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => navigate('/squads')}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-2 px-6 py-2.5 bg-linear-to-r from-primary-dark via-primary to-accent border-none rounded-lg text-white font-semibold text-sm cursor-pointer transition-all shadow-[0_4px_12px_rgba(49,151,167,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(49,151,167,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Creating…' : 'Create Squad'}
              </button>
            </FormActions>
          </form>
        </FormCard>

        {/* Info Card */}
        <div className="mt-6 bg-linear-to-br from-[rgba(49,151,167,0.04)] to-[rgba(139,92,246,0.02)] border border-border rounded-xl p-4">
          <p className="text-text-secondary text-sm m-0 leading-relaxed">
            💡 <strong>Tip:</strong> After creating your squad, you can add swimmers, schedule practices, and track performance metrics.
          </p>
        </div>
      </main>
    </div>
  )
}