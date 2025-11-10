// pages/SquadsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Calendar,
  ChevronRight,
  Droplets,
  Edit2,
  Trash2,
} from "lucide-react";
import SquadModal from "../components/squads/SquadModal";
import SquadFormModal from "../components/squads/SquadFormModal";
import {
  getSquadsForCoach,
  deleteSquad,
  updateSquad,
  createSquad,
  type SquadCard,
  type Squad,
  type UpdateSquadData,
  type CreateSquadData,
} from "../services/squadService";

export default function SquadsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachId = user?.id;

  const [items, setItems] = useState<SquadCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'edit' | 'delete'>('edit')
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  
  // Create squad modal state
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (!coachId) return;
    let mounted = true;
    setLoading(true);
    getSquadsForCoach(coachId)
      .then((data) => {
        if (mounted) {
          setItems(data);
          setErr("");
        }
      })
      .catch((e) => {
        if (mounted) setErr(e.message ?? "Failed to load squads");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [coachId]);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items]);

  const totalSwimmers = useMemo(
    () => items.reduce((sum, squad) => sum + squad.swimmers_count, 0),
    [items]
  );

  // Modal handlers
  const handleOpenEditModal = (squad: SquadCard) => {
    setSelectedSquad({
      id: squad.id,
      name: squad.name,
      description: squad.description,
      created_at: squad.created_at
    })
    setModalMode('edit')
    setShowModal(true)
  }

  const handleOpenDeleteModal = (squad: SquadCard) => {
    setSelectedSquad({
      id: squad.id,
      name: squad.name,
      description: squad.description,
      created_at: squad.created_at
    })
    setModalMode('delete')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedSquad(null)
  }

  const handleModalSubmit = async (updates?: UpdateSquadData, squadId?: string) => {
    if (!squadId) return

    try {
      if (modalMode === 'edit' && updates) {
        const updatedSquad = await updateSquad(squadId, updates)
        setItems(prev => prev.map(squad => 
          squad.id === squadId 
            ? { ...squad, name: updatedSquad.name, description: updatedSquad.description }
            : squad
        ))
      } else if (modalMode === 'delete') {
        await deleteSquad(squadId)
        setItems(prev => prev.filter(squad => squad.id !== squadId))
      }
    } catch (error: any) {
      setErr(error?.message || `Failed to ${modalMode} squad`)
      throw error
    }
  }

  // Create squad modal handlers
  const handleOpenCreateModal = () => setShowCreateModal(true)
  const handleCloseCreateModal = () => setShowCreateModal(false)
  
  const handleCreateSquad = async (squadData: CreateSquadData) => {
    if (!coachId) return

    try {
      const newSquad = await createSquad(coachId, squadData)
      
      // Update local state
      setItems(prev => [...prev, {
        id: newSquad.id,
        name: newSquad.name,
        description: newSquad.description,
        created_at: newSquad.created_at,
        role: 'owner' as const, // New squads have owner role
        swimmers_count: 0
      }])
      handleCloseCreateModal()
    } catch (error) {
      console.error('Error creating squad:', error)
      throw error // Let the modal handle the error display
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      {/* Header */}
      <header className="sticky top-0 z-[100] bg-background-elevated/95 backdrop-blur-xl border-b border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and Navigation */}
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                className="flex items-center gap-2 cursor-pointer transition-all hover:scale-105 bg-transparent border-none p-0"
                onClick={() => navigate('/')}
                title="Home"
              >
                <Droplets size={24} className="text-primary" />
                <span className="hidden md:inline text-lg font-bold bg-gradient-to-r from-primary-dark via-primary to-accent bg-clip-text text-transparent">
                  aquilus
                </span>
              </button>

              <span className="text-border text-xl hidden sm:inline">/</span>

              {/* Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border-2 border-primary/40 flex items-center justify-center shadow-lg">
                  <Users size={20} className="text-primary" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent drop-shadow-sm">
                  My Squads
                </h1>
              </div>
            </div>

            {/* Create Button */}
            <button
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
              onClick={handleOpenCreateModal}
            >
              <Plus size={18} />
              <span className="hidden sm:inline">New Squad</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>
      </header>

      {/* Error Toast */}
      {err && (
        <div className="fixed top-20 right-4 sm:right-6 bg-background-elevated border border-danger rounded-xl p-4 shadow-lg flex items-start gap-3 max-w-[90vw] sm:max-w-md z-[1000] animate-in slide-in-from-right duration-300">
          <div className="flex-1 min-w-0">
            <strong className="block text-danger text-sm font-semibold mb-1">
              Error
            </strong>
            <p className="m-0 text-text-secondary text-sm leading-relaxed">
              {err}
            </p>
          </div>
          <button
            className="text-text-muted hover:text-text-primary text-xl p-0 transition-colors"
            onClick={() => setErr("")}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Overview */}
        {!loading && !empty && (
          <section className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[280px] bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-5 flex items-center gap-4 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border-2 border-primary/40 flex items-center justify-center shadow-lg flex-shrink-0">
                <Users size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-3xl font-bold text-text-primary leading-none mb-1.5">
                  {items.length}
                </div>
                <div className="text-sm text-text-secondary font-medium">
                  Active Squads
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-[280px] bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-5 flex items-center gap-4 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border-2 border-primary/40 flex items-center justify-center shadow-lg flex-shrink-0">
                <Droplets size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-3xl font-bold text-text-primary leading-none mb-1.5">
                  {totalSwimmers}
                </div>
                <div className="text-sm text-text-secondary font-medium">
                  Total Swimmers
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-[280px] bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-5 flex items-center gap-4 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border-2 border-primary/40 flex items-center justify-center shadow-lg flex-shrink-0">
                <Calendar size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-3xl font-bold text-text-primary leading-none mb-1.5">
                  0
                </div>
                <div className="text-sm text-text-secondary font-medium">
                  Upcoming Meets
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Loading State */}
        {loading && (
          <section className="flex flex-wrap gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 min-w-[340px] max-w-[480px] bg-gradient-to-br from-background-elevated to-background-secondary/50 border border-border/60 rounded-xl p-6 flex flex-col gap-4 animate-pulse"
              >
                <div className="h-16 bg-background-tertiary/50 rounded-xl" />
                <div className="space-y-3">
                  <div className="h-4 bg-background-tertiary/50 rounded w-3/4" />
                  <div className="h-4 bg-background-tertiary/50 rounded w-1/2" />
                </div>
                <div className="h-12 bg-background-tertiary/50 rounded-lg mt-auto" />
              </div>
            ))}
          </section>
        )}

        {/* Empty State */}
        {empty && (
          <section className="flex items-center justify-center min-h-[500px] py-12">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Users size={48} className="text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                No Squads Yet
              </h2>
              <p className="text-base text-text-secondary mb-8 leading-relaxed">
                Create your first squad to start managing swimmers, tracking
                practices, and analyzing performance.
              </p>
              <button
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
                onClick={handleOpenCreateModal}
              >
                <Plus size={20} />
                <span>Create Your First Squad</span>
              </button>
            </div>
          </section>
        )}

        {/* Squads Grid */}
        {!loading && !empty && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((squad) => (
              <article
                key={squad.id}
                className="bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 flex flex-col gap-5 transition-all duration-200 hover:shadow-xl hover:border-primary/30 hover:scale-[1.02] relative overflow-hidden group"
              >
                {/* Badge */}
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-gradient-to-r from-accent-purple to-accent text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                  {squad.role}
                </div>

                {/* Header */}
                <div className="flex gap-4 items-start pr-20">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border border-primary/40 flex items-center justify-center shadow-lg shadow-primary/20">
                    <Users size={24} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-text-primary mb-1.5 truncate">
                      {squad.name || "Untitled Squad"}
                    </h3>
                    {squad.description && (
                      <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                        {squad.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-5 py-4 border-t border-b border-border/60">
                  <div className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <Users
                      size={18}
                      className="text-primary/70"
                    />
                    <span className="font-medium">
                      {squad.swimmers_count} swimmer
                      {squad.swimmers_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <Calendar
                      size={18}
                      className="text-primary/70"
                    />
                    <span className="font-medium">
                      {new Date(squad.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-primary to-accent text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
                    onClick={() => navigate(`/squads/${squad.id}`)}
                  >
                    <span>Open Squad</span>
                    <ChevronRight size={18} />
                  </button>

                  <div className="flex gap-3">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-background-elevated border border-border/60 text-text-secondary transition-all duration-200 hover:bg-primary/10 hover:border-primary/40 hover:text-primary hover:scale-105"
                      onClick={() => handleOpenEditModal(squad)}
                    >
                      <Edit2 size={16} />
                      <span>Edit</span>
                    </button>

                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-background-elevated border border-border/60 text-text-secondary transition-all duration-200 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-500 hover:scale-105"
                      onClick={() => handleOpenDeleteModal(squad)}
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
              </article>
            ))}
          </section>
        )}

        {/* Squad Modal */}
        <SquadModal
          isOpen={showModal}
          mode={modalMode}
          squad={selectedSquad}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
        />

        {/* Create Squad Modal */}
        <SquadFormModal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateSquad}
        />
      </main>
    </div>
  );
}