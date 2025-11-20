// pages/SquadsPage.tsx
import { useEffect, useMemo } from "react";
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
  useCurrentUser,
  useAllSquads,
  useModal,
} from "../hooks/useStores";
import { useSquadApi } from "../hooks/api";
import { useSquadStore, type Squad, type SquadCard } from "../stores/squadStore";
import { useUIStore } from "../stores/uiStore";
import type { UpdateSquadData, CreateSquadData } from "../services/api";

export default function SquadsPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const coachId = user?.id;

  // Use stores instead of local state
  const items = useAllSquads();
  const loading = useSquadStore(state => state.loading);
  const error = useSquadStore(state => state.error);
  
  // Use API hook with auto-store-sync
  const { fetchSquadsForCoach, createSquad, updateSquad, deleteSquad } = useSquadApi();
  
  // Use UI store for modals
  const editModal = useModal('squad-edit');
  const deleteModal = useModal('squad-delete');
  const createModal = useModal('squad-create');

  useEffect(() => {
    if (!coachId) return;
    let mounted = true;
    
    const { setLoading, setError } = useSquadStore.getState();
    
    setLoading(true);
    fetchSquadsForCoach(coachId)
      .catch((e) => {
        if (mounted) {
          setError(e.message ?? "Failed to load squads");
        }
      })
      .finally(() => mounted && setLoading(false));
    
    return () => {
      mounted = false;
    };
  }, [coachId, fetchSquadsForCoach]);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items]);

  const totalSwimmers = useMemo(
    () => items.reduce((sum, squad) => sum + squad.swimmers_count, 0),
    [items]
  );

  // Modal handlers
  const handleOpenEditModal = (squad: SquadCard) => {
    const squadData: Squad = {
      id: squad.id,
      name: squad.name,
      description: squad.description,
      created_at: squad.created_at
    };
    editModal.open(squadData);
  };

  const handleOpenDeleteModal = (squad: SquadCard) => {
    const squadData: Squad = {
      id: squad.id,
      name: squad.name,
      description: squad.description,
      created_at: squad.created_at
    };
    deleteModal.open(squadData);
  };

  const handleModalSubmit = async (updates?: UpdateSquadData, squadId?: string) => {
    if (!squadId) return;

    try {
      if (editModal.isOpen && updates) {
        // updateSquad hook already updates store and shows toast
        await updateSquad(squadId, updates);
        editModal.close();
      } else if (deleteModal.isOpen) {
        // deleteSquad hook already updates store and shows toast
        await deleteSquad(squadId);
        deleteModal.close();
      }
    } catch (error: any) {
      // Error already handled by hook with toast
      throw error;
    }
  };

  const handleCreateSquad = async (squadData: CreateSquadData) => {
    if (!coachId) return;

    try {
      // createSquad hook already updates store and shows toast
      await createSquad(coachId, squadData);
      createModal.close();
    } catch (error: any) {
      // Error already handled by hook with toast
      console.error('Error creating squad:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      {/* Error Toast - Now handled by UI store, but keeping for backwards compatibility */}
      {error && (
        <div className="fixed top-20 right-4 sm:right-6 bg-background-elevated border border-danger rounded-xl p-4 shadow-lg flex items-start gap-3 max-w-[90vw] sm:max-w-md z-1000 animate-in slide-in-from-right duration-300">
          <div className="flex-1 min-w-0">
            <strong className="block text-danger text-sm font-semibold mb-1">
              Error
            </strong>
            <p className="m-0 text-text-secondary text-sm leading-relaxed">
              {error}
            </p>
          </div>
          <button
            className="text-text-muted hover:text-text-primary text-xl p-0 transition-colors"
            onClick={() => useSquadStore.getState().clearError()}
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
                onClick={() => createModal.open()}
              >
                <Plus size={20} />
                <span>Create Your First Squad</span>
              </button>
            </div>
          </section>
        )}

        {/* Squads Grid */}
        {!loading && !empty && (
          <section className="flex flex-wrap gap-5">
            {items.map((squad) => (
              <article
                key={squad.id}
                className="flex-1 min-w-[340px] max-w-[480px] bg-linear-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-6 flex flex-col gap-5 transition-all duration-200 hover:shadow-xl hover:border-primary/30 hover:scale-[1.02] relative overflow-hidden group"
              >
                {/* Badge */}
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-gradient-to-r from-accent-purple to-accent text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
                  {squad.role}
                </div>

                {/* Header */}
                <div className="flex gap-4 items-start pr-20">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 via-primary/40 to-accent/30 border border-primary/40 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                    <Users size={24} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-text-primary mb-1.5 wrap-break-word">
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

        {/* Edit Squad Modal */}
        <SquadModal
          isOpen={editModal.isOpen}
          mode='edit'
          squad={editModal.data}
          onClose={editModal.close}
          onSubmit={handleModalSubmit}
        />

        {/* Delete Squad Modal */}
        <SquadModal
          isOpen={deleteModal.isOpen}
          mode='delete'
          squad={deleteModal.data}
          onClose={deleteModal.close}
          onSubmit={handleModalSubmit}
        />

        {/* Create Squad Modal */}
        <SquadFormModal
          isOpen={createModal.isOpen}
          onClose={createModal.close}
          onSubmit={handleCreateSquad}
        />
      </main>
    </div>
  );
}