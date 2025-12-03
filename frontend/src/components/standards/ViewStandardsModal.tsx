import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { TimeStandardsSet, TimeStandard } from '@/types/standards';
import { Search, Trash2, CheckSquare, Square, Plus, Edit2 } from 'lucide-react';
import { fetchStandards, deleteStandard } from '@/services/timeStandards';
import { AddStandardModal } from './AddStandardModal';
import { EditStandardModal } from './EditStandardModal';

interface ViewStandardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  standardsSet: TimeStandardsSet;
  onCountChange?: (newCount: number) => void;
}

export const ViewStandardsModal: React.FC<ViewStandardsModalProps> = ({
  isOpen,
  onClose,
  standardsSet,
  onCountChange
}) => {
  const [standards, setStandards] = useState<TimeStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStroke, setFilterStroke] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStandard, setEditingStandard] = useState<TimeStandard | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStandards();
    }
  }, [isOpen, standardsSet.id]);

  const loadStandards = async () => {
    try {
      setLoading(true);
      const data = await fetchStandards(standardsSet.id);
      setStandards(data);
    } catch (error) {
      console.error('Failed to fetch standards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStandard = async (standard: TimeStandard) => {
    if (!confirm(`Delete ${standard.distance}m ${standard.stroke} standard for ages ${standard.age_group_min}-${standard.age_group_max} (${standard.gender})?`)) {
      return;
    }

    try {
      await deleteStandard(standard.id);
      setStandards(prev => {
        const newStandards = prev.filter(s => s.id !== standard.id);
        onCountChange?.(newStandards.length);
        return newStandards;
      });
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(standard.id);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to delete standard:', error);
      alert('Failed to delete standard. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Delete ${selectedIds.size} selected standard(s)?`)) {
      return;
    }

    try {
      setDeleting(true);
      const deletePromises = Array.from(selectedIds).map(id => deleteStandard(id));
      await Promise.all(deletePromises);
      
      setStandards(prev => {
        const newStandards = prev.filter(s => !selectedIds.has(s.id));
        onCountChange?.(newStandards.length);
        return newStandards;
      });
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to delete standards:', error);
      alert('Failed to delete some standards. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddStandard = (standard: TimeStandard) => {
    setStandards(prev => {
      const newStandards = [standard, ...prev];
      onCountChange?.(newStandards.length);
      return newStandards;
    });
  };

  const handleEditStandard = (standard: TimeStandard) => {
    setEditingStandard(standard);
    setShowEditModal(true);
  };

  const handleUpdateStandard = (updatedStandard: TimeStandard) => {
    setStandards(prev => prev.map(s => s.id === updatedStandard.id ? updatedStandard : s));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStandards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStandards.map(s => s.id)));
    }
  };

  const filteredStandards = standards.filter(standard => {
    const matchesSearch = !searchQuery || 
      `${standard.distance}${standard.stroke}`.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStroke = filterStroke === 'all' || standard.stroke === filterStroke;
    const matchesGender = filterGender === 'all' || standard.gender === filterGender;

    return matchesSearch && matchesStroke && matchesGender;
  });

  const formatTime = (time?: string) => {
    if (!time) return '-';
    // Parse and format time properly
    // 00:00:33.00 -> 33.00
    // 00:00:33 -> 33.0
    // 00:01:23.50 -> 1:23.50
    // 00:12:45.30 -> 12:45.30
    
    const parts = time.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      let seconds = parts[2];
      
      // Ensure at least one decimal place
      if (!seconds.includes('.')) {
        seconds = seconds + '.0';
      }
      
      if (hours === 0 && minutes === 0) {
        // Just seconds: 33.00 or 33.0
        return seconds;
      } else if (hours === 0) {
        // Minutes and seconds: 1:23.50
        return `${minutes}:${seconds}`;
      } else {
        // Hours, minutes, seconds: 1:12:45.30
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds}`;
      }
    }
    return time;
  };

  const getStrokeName = (stroke: string) => {
    const names: Record<string, string> = {
      free: 'Freestyle',
      back: 'Backstroke',
      breast: 'Breaststroke',
      fly: 'Butterfly',
      im: 'IM'
    };
    return names[stroke] || stroke;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Standards: ${standardsSet.name}`}
      size="3xl"
    >
      <div className="space-y-4">
        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-4 bg-linear-to-r from-cyan-500/15 to-blue-500/10 backdrop-blur-sm border border-cyan-500/30 rounded-xl shadow-lg">
            <p className="text-sm text-cyan-300 font-semibold flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              {selectedIds.size} standard{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-linear-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        )}

        {/* Filters & Add Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by distance or stroke..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>
          <select
            value={filterStroke}
            onChange={(e) => setFilterStroke(e.target.value)}
            className="px-4 py-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
          >
            <option value="all">All Strokes</option>
            <option value="free">Freestyle</option>
            <option value="back">Backstroke</option>
            <option value="breast">Breaststroke</option>
            <option value="fly">Butterfly</option>
            <option value="im">IM</option>
          </select>
          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            className="px-4 py-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
          >
            <option value="all">All Genders</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="X">Mixed</option>
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg transition-colors shadow-lg shadow-cyan-500/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Standard
          </button>
        </div>

        {/* Standards Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700"></div>
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-400 border-t-transparent absolute top-0 left-0"></div>
            </div>
            <p className="text-sm text-slate-400">Loading standards...</p>
          </div>
        ) : (
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl overflow-hidden border border-slate-800/60 shadow-xl">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800 backdrop-blur-xl border-b border-slate-700/50 z-10">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105"
                        title={selectedIds.size === filteredStandards.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedIds.size === filteredStandards.length && filteredStandards.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Event</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Age Group</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Gender</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">SCM Time</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">LCM Time</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Level</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {filteredStandards.map((standard) => (
                    <tr key={standard.id} className="hover:bg-slate-800/40 transition-all group">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelection(standard.id)}
                          className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-all hover:scale-105"
                        >
                          {selectedIds.has(standard.id) ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-slate-100">{standard.distance}m</span>
                          <span className="text-sm text-slate-400">{getStrokeName(standard.stroke)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 bg-slate-800/50 border border-slate-700/50 rounded-md text-xs font-medium text-slate-300">
                          {standard.age_group_min === standard.age_group_max 
                            ? standard.age_group_min
                            : `${standard.age_group_min}-${standard.age_group_max}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 bg-slate-800/50 border border-slate-700/50 rounded-md text-xs font-medium text-slate-300">
                          {standard.gender}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-cyan-400">
                        {formatTime(standard.scm_time)}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-blue-400">
                        {formatTime(standard.lcm_time)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-linear-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400 border border-emerald-500/30 rounded-lg backdrop-blur-sm shadow-sm uppercase tracking-wide whitespace-nowrap">
                          {standard.standard_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditStandard(standard)}
                            className="p-2 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all hover:scale-105"
                            title="Edit standard"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStandard(standard)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all hover:scale-105"
                            title="Delete standard"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredStandards.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
                    <Search className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 font-medium">No standards found matching your filters</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <p className="text-sm text-slate-400 font-medium">
            Showing <span className="text-cyan-400 font-bold">{filteredStandards.length}</span> of <span className="text-slate-300 font-bold">{standards.length}</span> standards
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all hover:scale-105 hover:shadow-lg"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add/Edit Modals */}
      <AddStandardModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        standardsSetId={standardsSet.id}
        onSuccess={handleAddStandard}
      />

      {editingStandard && (
        <EditStandardModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingStandard(null);
          }}
          standard={editingStandard}
          onSuccess={handleUpdateStandard}
        />
      )}
    </Modal>
  );
};
