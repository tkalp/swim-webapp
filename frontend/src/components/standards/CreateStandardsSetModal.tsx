import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { TimeStandardsSet } from '@/types/standards';
import { createStandardsSet } from '@/services/timeStandards';

interface CreateStandardsSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateStandardsSetModal: React.FC<CreateStandardsSetModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    year: new Date().getFullYear(),
    description: '',
    active: true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      await createStandardsSet(formData);
      
      // Reset form and close
      setFormData({
        name: '',
        organization: '',
        year: new Date().getFullYear(),
        description: '',
        active: true
      });
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create standards set:', error);
      alert('Failed to create standards set. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Standards Set"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Swim Alberta 2024-2025"
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>

        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Organization <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            placeholder="e.g., Swim Alberta, USA Swimming"
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>

        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Year <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            required
            min={2000}
            max={2100}
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description of this standards set"
            rows={3}
            className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 resize-none"
          />
        </div>

        {/* Active */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/50"
          />
          <label htmlFor="active" className="text-sm text-slate-300">
            Set as active
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-700/50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create Standards Set'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
