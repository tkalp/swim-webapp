import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/workoutAnalysisService', () => ({
  analyzeWorkout: vi.fn(),
  getQuickWorkoutStats: vi.fn(),
}));

import { useWorkoutAnalysis } from '../useWorkoutAnalysis';
import { analyzeWorkout } from '@/services/workoutAnalysisService';

const mockAnalysis = {
  parser_used: 'llm' as const,
  total_meters: 1400,
  total_sets: 4,
  estimated_duration_minutes: 35,
  stroke_breakdown: {},
  activity_breakdown: {},
  energy_zone_breakdown: {},
  sections: [],
};

describe('useWorkoutAnalysis', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('starts with no analysis and not stale', () => {
    const { result } = renderHook(() => useWorkoutAnalysis());
    expect(result.current.analysis).toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('analyze() calls API and sets analysis', async () => {
    (analyzeWorkout as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnalysis);
    const { result } = renderHook(() => useWorkoutAnalysis());
    await act(async () => { await result.current.analyze('4x100 Free'); });
    expect(result.current.analysis).toEqual(mockAnalysis);
    expect(result.current.isStale).toBe(false);
  });

  it('marks analysis as stale', async () => {
    (analyzeWorkout as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnalysis);
    const { result } = renderHook(() => useWorkoutAnalysis());
    await act(async () => { await result.current.analyze('400 Free'); });
    act(() => { result.current.markStale(); });
    expect(result.current.isStale).toBe(true);
  });

  it('clear() resets everything', async () => {
    (analyzeWorkout as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnalysis);
    const { result } = renderHook(() => useWorkoutAnalysis());
    await act(async () => { await result.current.analyze('400 Free'); });
    act(() => { result.current.clear(); });
    expect(result.current.analysis).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('handles errors', async () => {
    (analyzeWorkout as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API down'));
    const { result } = renderHook(() => useWorkoutAnalysis());
    await act(async () => { await result.current.analyze('400 Free'); });
    expect(result.current.error).toBe('API down');
    expect(result.current.analysis).toBeNull();
  });

  it('empty text clears analysis', async () => {
    (analyzeWorkout as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnalysis);
    const { result } = renderHook(() => useWorkoutAnalysis());
    await act(async () => { await result.current.analyze('400 Free'); });
    await act(async () => { await result.current.analyze(''); });
    expect(result.current.analysis).toBeNull();
  });
});
