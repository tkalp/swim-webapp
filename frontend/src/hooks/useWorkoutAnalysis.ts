import { useState, useCallback } from 'react';
import { analyzeWorkout, type WorkoutAnalysis } from '@/services/workoutAnalysisService';

interface UseWorkoutAnalysisReturn {
  analysis: WorkoutAnalysis | null;
  isAnalyzing: boolean;
  isStale: boolean;
  error: string | null;
  analyze: (text: string) => Promise<void>;
  markStale: () => void;
  clear: () => void;
}

export function useWorkoutAnalysis(): UseWorkoutAnalysisReturn {
  const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (text: string) => {
    if (!text.trim()) {
      setAnalysis(null);
      setError(null);
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeWorkout(text);
      setAnalysis(result);
      setIsStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const markStale = useCallback(() => {
    if (analysis) setIsStale(true);
  }, [analysis]);

  const clear = useCallback(() => {
    setAnalysis(null);
    setIsStale(false);
    setError(null);
  }, []);

  return { analysis, isAnalyzing, isStale, error, analyze, markStale, clear };
}
