// components/workout/AIWorkoutSuggestions.tsx
import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Loader2, Brain, Target, Users } from 'lucide-react';
import { AIWorkoutService } from '../../services/aiWorkoutService';
import type { WorkoutSuggestion } from '../../services/aiWorkoutService';
import './AIWorkoutSuggestions.css';

interface AIWorkoutSuggestionsProps {
  workoutText: string;
  className?: string;
  onSelectWorkout?: (workoutText: string) => void;
  squadId?: string;
  targetStroke?: string;
  trainingFocus?: string;
}

export const AIWorkoutSuggestions: React.FC<AIWorkoutSuggestionsProps> = ({
  workoutText,
  className = '',
  onSelectWorkout,
  squadId,
  targetStroke,
  trainingFocus,
}) => {
  const [suggestions, setSuggestions] = useState<WorkoutSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-generate search query from current workout text
  useEffect(() => {
    if (workoutText && workoutText.length > 20) {
      // Extract key terms from the workout text for AI search
      const words = workoutText.toLowerCase().split(/\s+/);
      const keyTerms = words.filter(word => 
        word.includes('free') || word.includes('back') || word.includes('breast') || 
        word.includes('fly') || word.includes('sprint') || word.includes('endurance') ||
        word.includes('kick') || word.includes('pull') || word.includes('drill') ||
        /\d+m/.test(word) || /\d+x/.test(word)
      );
      
      if (keyTerms.length > 0) {
        setSearchQuery(keyTerms.slice(0, 5).join(' '));
      }
    }
  }, [workoutText]);

  const fetchSuggestions = async () => {
    if (!searchQuery && !squadId) return;

    setLoading(true);
    setError(null);
    
    try {
      let workoutSuggestions: WorkoutSuggestion[] = [];
      
      if (squadId) {
        // Use squad-based AI suggestions
        const squadSuggestions = await AIWorkoutService.getSquadWorkoutSuggestions(
          squadId,
          targetStroke,
          trainingFocus
        );
        workoutSuggestions = squadSuggestions.suggested_workouts;
      } else if (searchQuery) {
        // Use similarity search
        const similarWorkouts = await AIWorkoutService.findSimilarWorkouts(searchQuery, 4);
        workoutSuggestions = similarWorkouts.map((workout, index) => ({
          workout_text: workout.workout_text,
          similarity_score: workout.similarity_score,
          focus_rationale: {
            type: 'similarity',
            reasoning: `Similar to your current workout (${(workout.similarity_score * 100).toFixed(1)}% match)`,
            priority: 3 - Math.floor(index / 2), // Descending priority
          },
          coaching_notes: `Found based on workout similarity analysis`,
          priority: 3 - Math.floor(index / 2),
        }));
      }
      
      setSuggestions(workoutSuggestions);
    } catch (err) {
      console.error('Failed to fetch AI suggestions:', err);
      setError('Unable to load AI suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWorkout = (workout: string) => {
    navigator.clipboard.writeText(workout);
    // Could add a toast notification here
  };

  const handleSelectWorkout = (workout: string) => {
    if (onSelectWorkout) {
      onSelectWorkout(workout);
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 3: return '#10b981'; // High priority - green
      case 2: return '#f59e0b'; // Medium priority - yellow
      case 1: return '#6b7280'; // Low priority - gray
      default: return '#6b7280';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 3: return 'High Priority';
      case 2: return 'Medium Priority';
      case 1: return 'Low Priority';
      default: return 'Suggested';
    }
  };

  return (
    <div className={`ai-suggestions-card ${className}`}>
      <div className="ai-suggestions-header" onClick={() => setExpanded(!expanded)}>
        <div className="header-content">
          <Brain size={20} />
          <h3>AI Workout Suggestions</h3>
          {squadId && (
            <div className="ai-badge">
              <Users size={14} />
              <span>Squad AI</span>
            </div>
          )}
        </div>
        <div className="header-actions">
          {!expanded && (
            <button
              className="suggestion-button"
              onClick={(e) => {
                e.stopPropagation();
                fetchSuggestions();
              }}
              disabled={loading || (!searchQuery && !squadId)}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {loading ? 'Generating...' : 'Get Suggestions'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="ai-suggestions-content">
          <div className="suggestions-controls">
            {!squadId && (
              <div className="search-input">
                <input
                  type="text"
                  placeholder="Describe workout style (e.g., 'freestyle sprint 50m')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ai-search-input"
                />
              </div>
            )}
            
            <div className="control-buttons">
              <button
                className="refresh-button"
                onClick={fetchSuggestions}
                disabled={loading || (!searchQuery && !squadId)}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {loading ? 'Generating...' : 'Generate Suggestions'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span>{error}</span>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="suggestions-list">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="suggestion-item">
                  <div className="suggestion-header">
                    <div className="suggestion-meta">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(suggestion.priority) }}
                      >
                        {getPriorityLabel(suggestion.priority)}
                      </span>
                      {suggestion.focus_rationale.stroke && (
                        <span className="stroke-badge">
                          <Target size={12} />
                          {suggestion.focus_rationale.stroke}
                        </span>
                      )}
                    </div>
                    <div className="suggestion-actions">
                      <button
                        className="action-button copy-button"
                        onClick={() => handleCopyWorkout(suggestion.workout_text)}
                        title="Copy to clipboard"
                      >
                        <Copy size={14} />
                      </button>
                      {onSelectWorkout && (
                        <button
                          className="action-button select-button"
                          onClick={() => handleSelectWorkout(suggestion.workout_text)}
                          title="Use this workout"
                        >
                          Use
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="suggestion-workout">
                    <pre className="workout-text">{suggestion.workout_text}</pre>
                  </div>
                  
                  <div className="suggestion-notes">
                    <p className="coaching-notes">{suggestion.coaching_notes}</p>
                    <p className="rationale">{suggestion.focus_rationale.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {suggestions.length === 0 && !loading && !error && (
            <div className="empty-state">
              <Sparkles size={32} className="empty-icon" />
              <p>Click "Generate Suggestions" to get AI-powered workout recommendations</p>
              {squadId && (
                <p className="squad-hint">
                  AI will analyze your squad's performance data to suggest targeted workouts
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};