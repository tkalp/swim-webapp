import { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { 
  createWorkoutRating, 
  updateWorkoutRating, 
  getSessionRating,
  type WorkoutRating 
} from '@/services/workoutRatingsService';
import { useToast } from '@/contexts/ToastContext';

interface RateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  workoutId: string;
  workoutName?: string;
  onRatingSubmitted?: () => void;
}

export default function RateWorkoutModal({
  isOpen,
  onClose,
  sessionId,
  workoutId,
  workoutName = 'this workout',
  onRatingSubmitted,
}: RateWorkoutModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingRating, setExistingRating] = useState<WorkoutRating | null>(null);
  const { showToast } = useToast();

  // Fetch existing rating when modal opens
  useEffect(() => {
    if (isOpen && sessionId) {
      setLoading(true);
      getSessionRating(sessionId)
        .then((rating) => {
          if (rating) {
            setExistingRating(rating);
            setRating(rating.rating);
            setNotes(rating.notes || '');
          } else {
            setExistingRating(null);
            setRating(0);
            setNotes('');
          }
        })
        .catch(() => {
          setExistingRating(null);
          setRating(0);
          setNotes('');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (existingRating) {
        // Update existing rating
        await updateWorkoutRating(
          existingRating.id,
          rating,
          notes.trim() || undefined
        );
        showToast('Rating updated successfully!', 'success');
      } else {
        // Create new rating
        await createWorkoutRating({
          training_session_id: sessionId,
          workout_id: workoutId,
          rating,
          notes: notes.trim() || undefined,
        });
        showToast('Workout rated successfully!', 'success');
      }

      onRatingSubmitted?.();
      onClose();
      
      // Reset form
      setRating(0);
      setNotes('');
      setExistingRating(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to submit rating', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels = [
    'Not effective', 
    'Somewhat effective', 
    'Moderately effective', 
    'Very effective', 
    'Extremely effective'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              {existingRating ? 'Update Rating' : 'Rate Workout'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">{workoutName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                How effective was this workout?
              </label>
              <div className="flex items-center gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= (hoverRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-xs text-slate-400 mt-2 text-center">
                  {ratingLabels[rating - 1]}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations about this workout..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
                className="flex-1 bg-linear-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : existingRating ? 'Update Rating' : 'Submit Rating'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
