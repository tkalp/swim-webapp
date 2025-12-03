import React, { useState } from 'react';
import { Plus, Upload, Settings, Search, Filter } from 'lucide-react';
import { StandardsSetsList } from '@/components/standards/StandardsSetsList';
import { CreateStandardsSetModal } from '@/components/standards/CreateStandardsSetModal';
import { ImportStandardsModal } from '@/components/standards/ImportStandardsModal';

export default function TimeStandards() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-slate-900/40 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">
                Time Standards
              </h1>
              <p className="text-slate-400 mt-1">
                Manage swimming time standards for swimmer performance comparison
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4" />
                New Standards Set
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search standards sets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterActive('all')}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  filterActive === 'all'
                    ? 'bg-slate-600/50 text-slate-200 border border-slate-500/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterActive('active')}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  filterActive === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterActive('inactive')}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  filterActive === 'inactive'
                    ? 'bg-slate-500/20 text-slate-400 border border-slate-500/50'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/50'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StandardsSetsList 
          searchQuery={searchQuery}
          filterActive={filterActive}
          key={refreshKey}
        />
      </div>

      {/* Modals */}
      <CreateStandardsSetModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          handleRefresh();
          setShowCreateModal(false);
        }}
      />

      <ImportStandardsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          handleRefresh();
          setShowImportModal(false);
        }}
      />
    </div>
  );
}
