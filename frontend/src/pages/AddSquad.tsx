// pages/AddSquadPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createSquad } from '@/services/squadService'
import { Input, Textarea, Button, Breadcrumb } from '@/components/ui'
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

    console.log('Creating squad with coachId:', coachId)
    
    setLoading(true)
    try {
      // Create squad and coach_squads relationship
      const squad = await createSquad(coachId, {
        name: name.trim(),
        description: description.trim() || null
      })

      console.log('Squad created successfully:', squad)
      
      // Navigate to the newly created squad page
      navigate(`/squads`)
    } catch (err: any) {
      console.error('Error creating squad:', err)
      setError(err?.message || 'Failed to create squad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
        <Breadcrumb 
          items={[
            { label: 'Squads', href: '/squads' },
            { label: 'Create Squad' }
          ]}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Users size={24} className="text-cyan-400" />
            </div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Create Squad
            </h1>
          </div>
          <p className="text-slate-400 text-sm ml-15">Set up a new squad to manage your swimmers</p>
        </div>

        <div className="bg-slate-900/50 border-2 border-cyan-500/20 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
            Squad Details
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Squad Name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="E.g. Junior Sharks"
              disabled={loading}
              required
            />

            <Textarea
              label="Description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Short description for your squad"
              rows={4}
              disabled={loading}
              hint="Optional - Add a short description for your squad"
            />

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl text-red-400">
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                loadingText="Creating Squad..."
                icon={<Users size={20} />}
              >
                Create Squad
              </Button>
              
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/squads')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

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