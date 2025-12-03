import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { TimeStandard } from '@/types/standards';

interface EditStandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  standard: TimeStandard;
  onSuccess: (standard: TimeStandard) => void;
}

const STROKES = ['free', 'back', 'breast', 'fly', 'im'];
const COMMON_DISTANCES = [50, 100, 200, 400, 800, 1500];
const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'X', label: 'Mixed/Open' }
];

export const EditStandardModal: React.FC<EditStandardModalProps> = ({
  isOpen,
  onClose,
  standard,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    distance: standard.distance,
    stroke: standard.stroke,
    age_group_min: standard.age_group_min,
    age_group_max: standard.age_group_max,
    gender: standard.gender,
    scm_time: standard.scm_time || '',
    lcm_time: standard.lcm_time || '',
    standard_level: standard.standard_level,
    activity: standard.activity || 'swim',
    equipment: standard.equipment || 'none',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Update form when standard changes
  useEffect(() => {
    if (standard) {
      setFormData({
        distance: standard.distance,
        stroke: standard.stroke,
        age_group_min: standard.age_group_min,
        age_group_max: standard.age_group_max,
        gender: standard.gender,
        scm_time: standard.scm_time || '',
        lcm_time: standard.lcm_time || '',
        standard_level: standard.standard_level,
        activity: standard.activity || 'swim',
        equipment: standard.equipment || 'none',
      });
    }
  }, [standard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.scm_time && !formData.lcm_time) {
      setError('Please provide at least one time (SCM or LCM)');
      return;
    }

    if (!formData.standard_level.trim()) {
      setError('Please provide a standard level');
      return;
    }

    if (formData.age_group_min > formData.age_group_max) {
      setError('Minimum age must be less than or equal to maximum age');
      return;
    }

    setSaving(true);

    try {
      const { supabase } = await import('@/lib/supabase');
      
      const updateData = {
        distance: formData.distance,
        stroke: formData.stroke,
        age_group_min: formData.age_group_min,
        age_group_max: formData.age_group_max,
        gender: formData.gender,
        scm_time: formData.scm_time || null,
        lcm_time: formData.lcm_time || null,
        standard_level: formData.standard_level.trim(),
        activity: formData.activity,
        equipment: formData.equipment,
      };

      const { data, error: updateError } = await supabase
        .from('time_standards')
        .update(updateData)
        .eq('id', standard.id)
        .select()
        .single();

      if (updateError) throw updateError;

      onSuccess(data);
      onClose();
    } catch (err: any) {
      console.error('Failed to update standard:', err);
      setError(err.message || 'Failed to update standard. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Time Standard"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Event Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Distance (meters) <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.distance}
              onChange={(e) => setFormData({ ...formData, distance: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              required
            >
              {COMMON_DISTANCES.map(dist => (
                <option key={dist} value={dist}>{dist}m</option>
              ))}
              <option value={25}>25m</option>
              <option value={1650}>1650y</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Stroke <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.stroke}
              onChange={(e) => setFormData({ ...formData, stroke: e.target.value as typeof formData.stroke })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              required
            >
              {STROKES.map(stroke => (
                <option key={stroke} value={stroke}>
                  {stroke.charAt(0).toUpperCase() + stroke.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Age Group */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Min Age <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="6"
              max="99"
              value={formData.age_group_min}
              onChange={(e) => setFormData({ ...formData, age_group_min: parseInt(e.target.value) || 6 })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Max Age <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="6"
              max="99"
              value={formData.age_group_max}
              onChange={(e) => setFormData({ ...formData, age_group_max: parseInt(e.target.value) || 6 })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              required
            />
          </div>
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Gender <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {GENDERS.map(gender => (
              <button
                key={gender.value}
                type="button"
                onClick={() => setFormData({ ...formData, gender: gender.value as typeof formData.gender})}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.gender === gender.value
                    ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500/50'
                    : 'bg-slate-800/50 text-slate-400 border-2 border-slate-600/50 hover:border-slate-500/50'
                }`}
              >
                {gender.label}
              </button>
            ))}
          </div>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              SCM Time (MM:SS.ss)
            </label>
            <input
              type="text"
              placeholder="01:23.45"
              value={formData.scm_time}
              onChange={(e) => setFormData({ ...formData, scm_time: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">Short course (25m pool)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              LCM Time (MM:SS.ss)
            </label>
            <input
              type="text"
              placeholder="01:25.67"
              value={formData.lcm_time}
              onChange={(e) => setFormData({ ...formData, lcm_time: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">Long course (50m pool)</p>
          </div>
        </div>

        {/* Standard Level */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Standard Level <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., AAA, Gold, National"
            value={formData.standard_level}
            onChange={(e) => setFormData({ ...formData, standard_level: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
            required
          />
          <p className="text-xs text-slate-500 mt-1">Examples: AAA, AA, A, Gold, Silver, Bronze</p>
        </div>

        {/* Activity & Equipment (Advanced) */}
        <details className="group" open>
          <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-300">
            Advanced Options (optional)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3 pl-3 border-l-2 border-slate-700/50">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Activity
              </label>
              <select
                value={formData.activity}
                onChange={(e) => setFormData({ ...formData, activity: e.target.value as typeof formData.activity })}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              >
                <option value="swim">Swim</option>
                <option value="kick">Kick</option>
                <option value="drill">Drill</option>
                <option value="pull">Pull</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Equipment
              </label>
              <select
                value={formData.equipment}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value as typeof formData.equipment })}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              >
                <option value="none">None</option>
                <option value="fins">Fins</option>
                <option value="paddles">Paddles</option>
                <option value="snorkel">Snorkel</option>
                <option value="pull_buoy">Pull Buoy</option>
              </select>
            </div>
          </div>
        </details>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-700/50">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
