// components/workout/TagManager.tsx
import { useState, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { WorkoutTag } from '@/components/workout/WorkoutTag';
import { getCoachTags, createTag } from '@/services/workoutTagService';
import type { WorkoutTag as WorkoutTagType } from '@/types/workoutTags';
import { TAG_COLORS } from '@/types/workoutTags';

interface TagManagerProps {
  coachId: string;
  selectedTags: WorkoutTagType[];
  onTagsChange: (tags: WorkoutTagType[]) => void;
}

export function TagManager({ coachId, selectedTags, onTagsChange }: TagManagerProps) {
  const [allTags, setAllTags] = useState<WorkoutTagType[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState<typeof TAG_COLORS[number]>(TAG_COLORS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTags();
  }, [coachId]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const tags = await getCoachTags(coachId);
      setAllTags(tags);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const newTag = await createTag(coachId, {
        name: newTagName.trim(),
        color: selectedColor.hex,
      });

      setAllTags([...allTags, newTag]);
      setNewTagName('');
      setIsCreating(false);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to create tag');
    }
  };

  const toggleTag = (tag: WorkoutTagType) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-100">
        Tags
      </label>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-2 text-danger text-xs">
          {error}
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => (
            <WorkoutTag
              key={tag.id}
              tag={tag}
              onRemove={() => toggleTag(tag)}
            />
          ))}
        </div>
      )}

      {/* Tag Selector */}
      {loading ? (
        <div className="text-sm text-slate-400">Loading tags...</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allTags
            .filter(tag => !selectedTags.some(t => t.id === tag.id))
            .map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag)}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 border-dashed transition-all hover:scale-105"
                style={{
                  borderColor: tag.color,
                  color: tag.color,
                }}
              >
                <Plus size={14} />
                {tag.name}
              </button>
            ))}

          {/* Create New Tag Button */}
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 border-dashed border-slate-600 text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-all"
            >
              <Plus size={14} />
              New Tag
            </button>
          )}
        </div>
      )}

      {/* Create Tag Form */}
      {isCreating && (
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Tag Name
            </label>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g., Sprint, Endurance, Recovery..."
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/40 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              maxLength={50}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTag();
                } else if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewTagName('');
                }
              }}
            />
            <div className="text-xs text-slate-500 mt-1">
              {newTagName.length}/50 characters
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map(color => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    selectedColor.hex === color.hex
                      ? 'border-white scale-110 shadow-lg ring-2 ring-offset-2 ring-offset-slate-900 ring-white/50'
                      : 'border-slate-700/40 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreateTag}
              type="button"
              disabled={!newTagName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Check size={16} />
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewTagName('');
                setError('');
              }}
              type="button"
              className="px-4 py-2 bg-slate-800/50 text-slate-400 rounded-lg font-medium hover:bg-slate-700/50 hover:text-slate-100 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
