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
import SquadModal from '@/components/squads/SquadModal';
import SquadFormModal from '@/components/squads/SquadFormModal';
import { 
  useCurrentUser,
  useAllSquads,
  useModal,
} from '@/hooks/useStores';
import { useSquadApi } from '@/hooks/api';
import { useSquadStore, type Squad, type SquadCard } from '@/stores/squadStore';
import { useUIStore } from '@/stores/uiStore';
import type { UpdateSquadData, CreateSquadData } from '@/services/api';

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
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 right-4 sm:right-6 bg-slate-900/95 backdrop-blur-xl border border-red-500/30 rounded-xl p-4 shadow-2xl shadow-red-500/10 flex items-start gap-3 max-w-[90vw] sm:max-w-md z-1000 animate-in slide-in-from-right duration-300">
          <div className="flex-1 min-w-0">
            <strong className="block text-red-400 text-sm font-semibold mb-1">
              Error
            </strong>
            <p className="m-0 text-slate-400 text-sm leading-relaxed">
              {error}
            </p>
          </div>
          <button
            className="text-slate-500 hover:text-slate-300 text-xl p-0 transition-colors"
            onClick={() => useSquadStore.getState().clearError()}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              My Squads
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Manage your swimming squads and track performance
            </p>
          </div>
          
          {!empty && (
            <button
              className="group relative px-6 py-3 rounded-xl font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25"
              onClick={() => createModal.open()}
            >
              <div className="absolute inset-0 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500" />
              <div className="absolute inset-0 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2">
                <Plus size={20} strokeWidth={2.5} />
                <span>New Squad</span>
              </span>
            </button>
          )}
        </div>

        {/* Stats Overview */}
        {!loading && !empty && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="group relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Users size={24} className="text-cyan-400" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {items.length}
                  </div>
                  <div className="text-sm text-slate-400 font-medium">
                    Active Squads
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-blue-500/10 to-transparent rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-linear-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Droplets size={24} className="text-blue-400" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {totalSwimmers}
                  </div>
                  <div className="text-sm text-slate-400 font-medium">
                    Total Swimmers
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-purple-500/10 to-transparent rounded-full blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-linear-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Calendar size={24} className="text-purple-400" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-3xl font-bold text-white mb-1">
                    0
                  </div>
                  <div className="text-sm text-slate-400 font-medium">
                    Upcoming Meets
                  </div>
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
                className="flex-1 min-w-[340px] max-w-[480px] bg-linear-to-br from-slate-900/50 to-slate-800/50 border border-slate-800/60 rounded-2xl p-6 flex flex-col gap-4 animate-pulse"
              >
                <div className="h-16 bg-slate-800/50 rounded-xl" />
                <div className="space-y-3">
                  <div className="h-4 bg-slate-800/50 rounded w-3/4" />
                  <div className="h-4 bg-slate-800/50 rounded w-1/2" />
                </div>
                <div className="h-12 bg-slate-800/50 rounded-lg mt-auto" />
              </div>
            ))}
          </section>
        )}

        {/* Empty State */}
        {empty && (
          <section className="flex items-center justify-center min-h-[500px] py-12">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shadow-xl shadow-cyan-500/10">
                <Users size={48} className="text-cyan-400" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                No Squads Yet
              </h2>
              <p className="text-base text-slate-400 mb-8 leading-relaxed">
                Create your first squad to start managing swimmers, tracking
                practices, and analyzing performance.
              </p>
              <button
                className="group relative inline-flex items-center gap-2 px-7 py-3.5 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/25 overflow-hidden"
                onClick={() => createModal.open()}
              >
                <div className="absolute inset-0 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500" />
                <div className="absolute inset-0 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-2">
                  <Plus size={20} strokeWidth={2.5} />
                  <span>Create Your First Squad</span>
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Squads Grid */}
        {!loading && !empty && (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {items.map((squad) => (
              <article
                key={squad.id}
                className="group relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 flex flex-col gap-5 transition-all duration-300 hover:scale-[1.02] hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-linear-to-br from-cyan-500/0 via-blue-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                
                {/* Badge */}
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-linear-to-r from-purple-500 to-pink-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg shadow-purple-500/20">
                  {squad.role}
                </div>

                {/* Header */}
                <div className="relative flex gap-4 items-start pr-20">
                  <div className="w-14 h-14 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10 shrink-0 group-hover:scale-110 group-hover:shadow-cyan-500/20 transition-all duration-300">
                    <Users size={24} className="text-cyan-400" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-1.5 wrap-break-word group-hover:text-cyan-400 transition-colors duration-300">
                      {squad.name || "Untitled Squad"}
                    </h3>
                    {squad.description && (
                      <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                        {squad.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="relative flex flex-wrap gap-5 py-4 border-t border-b border-slate-800/60">
                  <div className="flex items-center gap-2.5 text-sm text-slate-400">
                    <Users
                      size={18}
                      className="text-cyan-400"
                      strokeWidth={2.5}
                    />
                    <span className="font-medium">
                      {squad.swimmers_count} swimmer
                      {squad.swimmers_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-slate-400">
                    <Calendar
                      size={18}
                      className="text-blue-400"
                      strokeWidth={2.5}
                    />
                    <span className="font-medium">
                      {new Date(squad.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative flex flex-col gap-3">
                  <button
                    className="group/btn relative overflow-hidden flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/25"
                    onClick={() => navigate(`/squads/${squad.id}`)}
                  >
                    <div className="absolute inset-0 bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500" />
                    <div className="absolute inset-0 bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                    <span className="relative">Open Squad</span>
                    <ChevronRight size={18} className="relative" strokeWidth={2.5} />
                  </button>

                  <div className="flex gap-3">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-slate-800/50 border border-slate-700/50 text-slate-400 transition-all duration-300 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/10"
                      onClick={() => handleOpenEditModal(squad)}
                    >
                      <Edit2 size={16} strokeWidth={2.5} />
                      <span>Edit</span>
                    </button>

                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm bg-slate-800/50 border border-slate-700/50 text-slate-400 transition-all duration-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 hover:scale-105 hover:shadow-lg hover:shadow-red-500/10"
                      onClick={() => handleOpenDeleteModal(squad)}
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
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