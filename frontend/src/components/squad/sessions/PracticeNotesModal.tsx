// components/squad/sessions/PracticeNotesModal.tsx
import { useState, useEffect } from 'react';
import { X, FileText, Star, TrendingUp, Target, Smile, Sparkles, AlertCircle } from 'lucide-react';
import { 
  getPrePracticeNote, 
  getPostPracticeNote,
  upsertPrePracticeNote,
  upsertPostPracticeNote,
} from '@/services/practiceNotesService';
import type { PrePracticeNote, PostPracticeNote } from '@/types/practiceNotes';

interface PracticeNotesModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionDate: string;
  noteType: 'pre' | 'post';
}

const RATING_LABELS = {
  overall_rating: { label: 'Overall Session', icon: Star, color: 'text-yellow-400' },
  effort_level: { label: 'Effort Level', icon: TrendingUp, color: 'text-blue-400' },
  technique_quality: { label: 'Technique Quality', icon: Target, color: 'text-green-400' },
  positivity: { label: 'Team Positivity', icon: Smile, color: 'text-pink-400' },
};

export default function PracticeNotesModal({
  open,
  onClose,
  sessionId,
  sessionDate,
  noteType,
}: PracticeNotesModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-practice fields
  const [announcements, setAnnouncements] = useState('');
  const [reminders, setReminders] = useState('');
  const [focus, setFocus] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState('');
  const [preNotes, setPreNotes] = useState('');

  // Post-practice fields
  const [overallRating, setOverallRating] = useState<number | undefined>();
  const [effortLevel, setEffortLevel] = useState<number | undefined>();
  const [techniqueQuality, setTechniqueQuality] = useState<number | undefined>();
  const [positivity, setPositivity] = useState<number | undefined>();
  const [whatWentWell, setWhatWentWell] = useState('');
  const [areasForImprovement, setAreasForImprovement] = useState('');
  const [nextSessionFocus, setNextSessionFocus] = useState('');
  const [individualHighlights, setIndividualHighlights] = useState('');
  const [postNotes, setPostNotes] = useState('');

  useEffect(() => {
    if (open && sessionId) {
      loadNotes();
    }
  }, [open, sessionId, noteType]);

  const loadNotes = async () => {
    setLoading(true);
    setError('');
    try {
      if (noteType === 'pre') {
        const data = await getPrePracticeNote(sessionId);
        if (data) {
          setAnnouncements(data.announcements || '');
          setReminders(data.reminders || '');
          setFocus(data.focus || '');
          setEquipmentNeeded(data.equipment_needed || '');
          setPreNotes(data.notes || '');
        }
      } else {
        const data = await getPostPracticeNote(sessionId);
        if (data) {
          setOverallRating(data.overall_rating);
          setEffortLevel(data.effort_level);
          setTechniqueQuality(data.technique_quality);
          setPositivity(data.positivity);
          setWhatWentWell(data.what_went_well || '');
          setAreasForImprovement(data.areas_for_improvement || '');
          setNextSessionFocus(data.next_session_focus || '');
          setIndividualHighlights(data.individual_highlights || '');
          setPostNotes(data.notes || '');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    
    try {
      if (noteType === 'pre') {
        await upsertPrePracticeNote({
          training_session_id: sessionId,
          announcements: announcements || undefined,
          reminders: reminders || undefined,
          focus: focus || undefined,
          equipment_needed: equipmentNeeded || undefined,
          notes: preNotes || undefined,
        });
      } else {
        await upsertPostPracticeNote({
          training_session_id: sessionId,
          overall_rating: overallRating,
          effort_level: effortLevel,
          technique_quality: techniqueQuality,
          positivity: positivity,
          what_went_well: whatWentWell || undefined,
          areas_for_improvement: areasForImprovement || undefined,
          next_session_focus: nextSessionFocus || undefined,
          individual_highlights: individualHighlights || undefined,
          notes: postNotes || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const renderRatingSelector = (
    value: number | undefined,
    onChange: (value: number | undefined) => void,
    config: typeof RATING_LABELS[keyof typeof RATING_LABELS]
  ) => {
    const Icon = config.icon;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={config.color} />
          <label className="text-sm font-medium text-text-primary">{config.label}</label>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(value === rating ? undefined : rating)}
              className={`w-12 h-12 rounded-xl border-2 transition-all font-semibold ${
                value === rating
                  ? 'bg-primary border-primary text-white scale-110 shadow-lg'
                  : 'bg-background-tertiary border-border hover:border-primary/50 text-text-secondary hover:text-text-primary hover:scale-105'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-linear-to-br from-background-elevated to-background-secondary/50 rounded-2xl shadow-2xl border border-border/60 w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              {noteType === 'pre' ? <FileText size={20} className="text-primary" /> : <Sparkles size={20} className="text-accent" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                {noteType === 'pre' ? 'Pre-Practice Notes' : 'Post-Practice Notes'}
              </h2>
              <p className="text-sm text-text-secondary">
                {new Date(sessionDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background-secondary transition-colors text-text-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-danger shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-danger">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-text-secondary">Loading notes...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {noteType === 'pre' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Announcements
                    </label>
                    <textarea
                      value={announcements}
                      onChange={(e) => setAnnouncements(e.target.value)}
                      placeholder="Any important announcements for the team..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Reminders
                    </label>
                    <textarea
                      value={reminders}
                      onChange={(e) => setReminders(e.target.value)}
                      placeholder="Things to remember for this session..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Session Focus
                    </label>
                    <input
                      type="text"
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      placeholder="e.g., Underwater work, Turns, Starts..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Equipment Needed
                    </label>
                    <input
                      type="text"
                      value={equipmentNeeded}
                      onChange={(e) => setEquipmentNeeded(e.target.value)}
                      placeholder="e.g., Fins, paddles, snorkels..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Additional Notes
                    </label>
                    <textarea
                      value={preNotes}
                      onChange={(e) => setPreNotes(e.target.value)}
                      placeholder="Any other notes or comments..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Ratings Section */}
                  <div className="bg-background-tertiary/30 rounded-xl p-5 border border-border/30 space-y-5">
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Session Ratings (Optional)</h3>
                    {renderRatingSelector(overallRating, setOverallRating, RATING_LABELS.overall_rating)}
                    {renderRatingSelector(effortLevel, setEffortLevel, RATING_LABELS.effort_level)}
                    {renderRatingSelector(techniqueQuality, setTechniqueQuality, RATING_LABELS.technique_quality)}
                    {renderRatingSelector(positivity, setPositivity, RATING_LABELS.positivity)}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      What Went Well ✨
                    </label>
                    <textarea
                      value={whatWentWell}
                      onChange={(e) => setWhatWentWell(e.target.value)}
                      placeholder="Highlight the positives from this session..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Areas for Improvement 🎯
                    </label>
                    <textarea
                      value={areasForImprovement}
                      onChange={(e) => setAreasForImprovement(e.target.value)}
                      placeholder="What can we work on next time..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Next Session Focus
                    </label>
                    <input
                      type="text"
                      value={nextSessionFocus}
                      onChange={(e) => setNextSessionFocus(e.target.value)}
                      placeholder="What to emphasize next practice..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Individual Highlights 🌟
                    </label>
                    <textarea
                      value={individualHighlights}
                      onChange={(e) => setIndividualHighlights(e.target.value)}
                      placeholder="Shout-outs to swimmers who stood out..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Additional Notes
                    </label>
                    <textarea
                      value={postNotes}
                      onChange={(e) => setPostNotes(e.target.value)}
                      placeholder="Any other observations or comments..."
                      className="w-full px-4 py-3 bg-background-tertiary border border-border rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-background-secondary/20">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-background-tertiary hover:bg-background-secondary text-text-secondary hover:text-text-primary font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2.5 rounded-xl bg-linear-to-r from-primary to-accent text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
