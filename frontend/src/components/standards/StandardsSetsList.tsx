import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, ChevronRight, Calendar, Building, Eye, EyeOff } from 'lucide-react';
import { TimeStandardsSet } from '@/types/standards';
import { EditStandardsSetModal } from './EditStandardsSetModal';
import { ViewStandardsModal } from './ViewStandardsModal';
import * as timeStandardsAPI from '@/services/timeStandards';

interface StandardsSetsListProps {
  searchQuery: string;
  filterActive: 'all' | 'active' | 'inactive';
}

export const StandardsSetsList: React.FC<StandardsSetsListProps> = ({ 
  searchQuery, 
  filterActive 
}) => {
  const [standardsSets, setStandardsSets] = useState<TimeStandardsSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<TimeStandardsSet | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchStandardsSets();
  }, []);

  const fetchStandardsSets = async () => {
    try {
      setLoading(true);
      const data = await timeStandardsAPI.fetchStandardsSets();
      setStandardsSets(data);
    } catch (error) {
      console.error('Failed to fetch standards sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (set: TimeStandardsSet) => {
    try {
      await timeStandardsAPI.updateStandardsSet(set.id, { active: !set.active });
      setStandardsSets(prev => 
        prev.map(s => s.id === set.id ? { ...s, active: !s.active } : s)
      );
    } catch (error) {
      console.error('Failed to toggle active status:', error);
    }
  };

  const handleDelete = async (set: TimeStandardsSet) => {
    if (!confirm(`Are you sure you want to delete "${set.name}"? This will also delete all ${set.standards_count} individual standards.`)) {
      return;
    }

    try {
      await timeStandardsAPI.deleteStandardsSet(set.id);
      setStandardsSets(prev => prev.filter(s => s.id !== set.id));
    } catch (error) {
      console.error('Failed to delete standards set:', error);
    }
  };

  const handleEdit = (set: TimeStandardsSet) => {
    setSelectedSet(set);
    setShowEditModal(true);
  };

  const handleView = (set: TimeStandardsSet) => {
    setSelectedSet(set);
    setShowViewModal(true);
  };

  const filteredSets = standardsSets.filter(set => {
    // Apply search filter
    const matchesSearch = !searchQuery || 
      set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (set.organization?.toLowerCase() ?? '').includes(searchQuery.toLowerCase());

    // Apply active filter
    const matchesActive = filterActive === 'all' || 
      (filterActive === 'active' && set.active) ||
      (filterActive === 'inactive' && !set.active);

    return matchesSearch && matchesActive;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  if (filteredSets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 font-medium">No standards sets found</p>
        <p className="text-slate-500 text-sm mt-2">
          {searchQuery || filterActive !== 'all' 
            ? 'Try adjusting your filters'
            : 'Create your first standards set to get started'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSets.map((set) => (
          <div
            key={set.id}
            className="group relative bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all overflow-hidden"
          >
            {/* Status indicator */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${
              set.active ? 'bg-linear-to-r from-emerald-500 to-cyan-500' : 'bg-slate-600'
            }`} />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
                    {set.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Building className="w-3.5 h-3.5" />
                      {set.organization}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {set.year}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(set)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    set.active 
                      ? 'text-emerald-400 hover:bg-emerald-500/10' 
                      : 'text-slate-500 hover:bg-slate-700/50'
                  }`}
                  title={set.active ? 'Active' : 'Inactive'}
                >
                  {set.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {/* Description */}
              {set.description && (
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                  {set.description}
                </p>
              )}

              {/* Stats */}
              <div className="bg-slate-900/40 rounded-lg p-3 mb-4">
                <div className="text-2xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">
                  {set.standards_count}
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  Individual Standards
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleView(set)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
                >
                  View Standards
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleEdit(set)}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(set)}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {selectedSet && (
        <>
          <EditStandardsSetModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedSet(null);
            }}
            standardsSet={selectedSet}
            onUpdate={fetchStandardsSets}
          />

          <ViewStandardsModal
            isOpen={showViewModal}
            onClose={() => {
              setShowViewModal(false);
              setSelectedSet(null);
            }}
            standardsSet={selectedSet}
            onCountChange={(newCount) => {
              setStandardsSets(prev => 
                prev.map(s => s.id === selectedSet.id ? { ...s, standards_count: newCount } : s)
              );
            }}
          />
        </>
      )}
    </>
  );
};
