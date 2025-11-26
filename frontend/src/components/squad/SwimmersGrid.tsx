// components/squad/SwimmersGrid.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Plus, Edit2, Trash2 } from "lucide-react";
import SwimmerModal from "@/components/squad/SwimmerModal";
import { SquadTabHeader } from "@/components/squad/SquadTabHeader";
import type {
  Swimmer,
  CreateSwimmerData,
  UpdateSwimmerData,
} from "@/services/swimmerService";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useToast } from "@/contexts/ToastContext"; // if using alerts
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Props = {
  swimmers: Swimmer[];
  squadId: string;
  canManage: boolean;
  onAddSwimmer: (swimmer: CreateSwimmerData) => Promise<Swimmer>;
  onEditSwimmer: (id: string, swimmer: UpdateSwimmerData) => Promise<void>;
  onDeleteSwimmer: (id: string) => Promise<void>;
};

export default function SwimmersGrid({
  swimmers,
  squadId,
  canManage,
  onAddSwimmer,
  onEditSwimmer,
  onDeleteSwimmer,
}: Props) {
  const navigate = useNavigate();
  const confirmDialog = useConfirmDialog();
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"last" | "first" | "dob">("last");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingSwimmer, setEditingSwimmer] = useState<Swimmer | null>(null);

  const items = useMemo(() => {
    const norm = (s: string | null | undefined) =>
      (s ?? "").toLowerCase().trim();
    let filtered = swimmers.filter((s) => {
      const full = `${norm(s.first_name)} ${norm(s.last_name)}`;
      return full.includes(q.toLowerCase().trim());
    });
    filtered.sort((a, b) => {
      if (sortBy === "last")
        return (a.last_name ?? "").localeCompare(b.last_name ?? "");
      if (sortBy === "first")
        return (a.first_name ?? "").localeCompare(b.first_name ?? "");
      // dob: newest first
      const da = a.date_of_birth ? new Date(a.date_of_birth).getTime() : 0;
      const db = b.date_of_birth ? new Date(b.date_of_birth).getTime() : 0;
      return db - da;
    });
    return filtered;
  }, [swimmers, q, sortBy]);

  const handleOpenAddModal = () => {
    setModalMode("add");
    setEditingSwimmer(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (swimmer: Swimmer) => {
    setModalMode("edit");
    setEditingSwimmer(swimmer);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSwimmer(null);
  };

  const handleModalSubmit = async (
    swimmerData: CreateSwimmerData | UpdateSwimmerData,
    swimmerId?: string
  ) => {
    if (modalMode === "add") {
      const newSwimmer = await onAddSwimmer(swimmerData as CreateSwimmerData);
      return newSwimmer;
    } else if (swimmerId) {
      await onEditSwimmer(swimmerId, swimmerData as UpdateSwimmerData);
    }
  };

  const handleDelete = async (swimmer: Swimmer) => {
    const confirmed = await confirmDialog.confirm({
      title: "Remove Swimmer from Squad",
      message:
        "Are you sure you want to delete this swimmer? All related swimmer data will be removed",
      confirmText: "Delete",
      variant: "danger"
    });

    if (!confirmed) return;

    try {
      await onDeleteSwimmer(swimmer.id);
    } catch (error) {
      console.error("Error deleting swimmer:", error);
    }
  };

  if (!swimmers.length) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 bg-linear-to-br from-slate-950/50 via-transparent to-slate-950/50">
        <div className="flex flex-col items-center justify-center py-24 px-4">
          <div className="relative group mb-6">
            <div className="absolute inset-0 bg-linear-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-2xl" />
            <div className="relative w-20 h-20 rounded-2xl bg-slate-800/50 border-2 border-slate-700/50 flex items-center justify-center">
              <User size={40} className="text-slate-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text mb-3">
            No Swimmers Yet
          </h3>
          <p className="text-slate-400 mb-8 max-w-md text-center text-sm">
            Get started by adding your first swimmer to this squad.
          </p>
          {canManage && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-500 hover:shadow-lg hover:shadow-cyan-500/30 text-white rounded-lg font-semibold transition-all duration-200 hover:scale-105"
            >
              <Plus size={18} />
              Add First Swimmer
            </button>
          )}
        </div>

        <SwimmerModal
          isOpen={showModal}
          mode={modalMode}
          swimmer={editingSwimmer}
          squadId={squadId}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
        />
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 bg-linear-to-br from-slate-950/50 via-transparent to-slate-950/50">
      {/* Page Header */}
      <SquadTabHeader
        title="Team Members"
        subtitle={`${items.length} swimmer${
          items.length === 1 ? "" : "s"
        } in this squad`}
        actions={
          canManage ? (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              <Plus size={18} />
              Add Swimmer
            </button>
          ) : undefined
        }
      />

      {/* Search and Sort Toolbar */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors"
                placeholder="Search swimmers by name..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-3">
            <select
              id="sortBy"
              className="px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="last">Sort by Last name</option>
              <option value="first">Sort by First name</option>
              <option value="dob">Sort by Age</option>
            </select>
          </div>
        </div>

        {/* Search Results Count */}
        {q && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              Found{" "}
              <span className="font-semibold text-cyan-400">
                {items.length}
              </span>{" "}
              swimmer{items.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      {/* Swimmers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((s, index) => {
          const initials = getInitials(s.first_name, s.last_name);
          const age = s.date_of_birth ? calcAge(s.date_of_birth) : null;

          return (
            <div
              key={s.id}
              onClick={() => navigate(`/swimmers/${s.id}`)}
              className="group relative overflow-hidden bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200 cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/swimmers/${s.id}`);
                }
              }}
            >
              {/* Subtle glow on hover */}
              <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative flex items-start gap-3">
                {/* Avatar */}
                <div className="shrink-0">
                  <div className="w-14 h-14 bg-linear-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-300 font-bold text-sm shadow-lg">
                    {initials}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-100 text-base truncate group-hover:text-transparent group-hover:bg-linear-to-r group-hover:from-cyan-400 group-hover:to-blue-400 group-hover:bg-clip-text transition-all duration-200">
                      {formatName(s.first_name, s.last_name)}
                    </h3>

                    {/* Action Buttons */}
                    {canManage && (
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="p-2 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
                          title="Edit swimmer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-2 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded transition-colors"
                          title="Delete swimmer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {age !== null && (
                      <span className="inline-flex items-center px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded font-medium">
                        Age {age}
                      </span>
                    )}
                    {s.sex && (
                      <>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">{s.sex}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No Results */}
      {q && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-6">
            <Search size={40} className="text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-100 mb-3">
            No Results Found
          </h3>
          <p className="text-slate-400 max-w-md text-center">
            No swimmers match your search for "
            <span className="font-semibold text-cyan-400">{q}</span>"
          </p>
        </div>
      )}

      <SwimmerModal
        isOpen={showModal}
        mode={modalMode}
        swimmer={editingSwimmer}
        squadId={squadId}
        onClose={handleCloseModal}
        onSubmit={handleModalSubmit}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.handleCancel}
        onConfirm={confirmDialog.handleConfirm}
        title={confirmDialog.options.title}
        message={confirmDialog.options.message}
        confirmText={confirmDialog.options.confirmText}
        cancelText={confirmDialog.options.cancelText}
        variant={confirmDialog.options.variant}
      />
    </div>
  );
}

/* ----- Helpers ----- */
function getInitials(first?: string | null, last?: string | null) {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  if (!a && !b) return "??";
  if (!b) return a.slice(0, 2).toUpperCase();
  return (a[0] + b[0]).toUpperCase();
}

function formatName(first?: string | null, last?: string | null) {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return "Unnamed";
  return `${l}${l && f ? ", " : ""}${f}`;
}

function calcAge(dobISO: string) {
  const dob = new Date(dobISO);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
