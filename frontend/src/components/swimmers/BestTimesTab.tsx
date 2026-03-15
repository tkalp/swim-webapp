import { useEffect, useMemo, useState } from "react";
import {
  getSwimmerBestTimes,
  getSwimmerPredictions,
  type BestTimeResult,
  type EventQuery,
  type SwimmerPredictionsResponse,
} from '@/services/workoutResultService';
import GroupedBestTimesView from '@/components/swimmers/bestTimes/GroupedBestTimesView';
import AttemptsModal from '@/components/swimmers/bestTimes/AttemptsModal';
import AddEditWorkoutResultModal from '@/components/swimmers/bestTimes/AddEditWorkoutResultModal';
import { apiClient } from '@/lib/apiClient';
import { Activity, TrendingUp, Plus, Sparkles, HelpCircle, X, Users } from "lucide-react";
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import Modal from '@/components/ui/Modal';
import { useSquadBenchmarks } from '@/hooks/useSquadBenchmarks';

type Swimmer = {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  sex?: string;
  squad_id?: string;
};

export default function BestTimesTab({ swimmerId, swimmer, canManageResults }: { swimmerId: string; swimmer?: Swimmer; canManageResults?: boolean }) {
  const { hasTimeStandards } = useFeatureFlags();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [allBest, setAllBest] = useState<BestTimeResult[]>([]);
  const [predictions, setPredictions] = useState<SwimmerPredictionsResponse | null>(null);
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  const [query, setQuery] = useState<EventQuery | null>(null);
  const [open, setOpen] = useState(false);
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<BestTimeResult | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showPredictionsGuide, setShowPredictionsGuide] = useState(false);
  const [showSquadRanks, setShowSquadRanks] = useState(false);
  
  // Lazy load squad benchmarks only when enabled
  useEffect(() => {
    console.log('==== BestTimesTab Debug ====');
    console.log('Swimmer ID:', swimmerId);
    console.log('Swimmer object:', swimmer);
    console.log('Squad ID from swimmer:', swimmer?.squad_id);
    console.log('Show squad ranks:', showSquadRanks);
  }, [swimmerId, swimmer, showSquadRanks]);
  
  const { data: squadBenchmarks = {}, isLoading: squadBenchmarksLoading } = useSquadBenchmarks(
    swimmer?.squad_id,
    showSquadRanks
  );

  const refreshData = () => {
    setLoading(true);
    (async () => {
      try {
        const data = await getSwimmerBestTimes(swimmerId);
        setAllBest(data);
        setErr("");
        
        // Fetch predictions in parallel
        setPredictionsLoading(true);
        try {
          const predictionsData = await getSwimmerPredictions(swimmerId, 3);
          setPredictions(predictionsData);
        } catch (predError: any) {
          console.error('Failed to load predictions:', predError);
          // Don't set error state - predictions are optional
        } finally {
          setPredictionsLoading(false);
        }
      } catch (e: any) {
        setErr(e.message ?? "Failed to load best times");
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const data = await getSwimmerBestTimes(swimmerId);
        if (!mounted) return;
        setAllBest(data);
        setErr("");
        
        // Fetch predictions in parallel
        setPredictionsLoading(true);
        try {
          const predictionsData = await getSwimmerPredictions(swimmerId, 3);
          if (!mounted) return;
          setPredictions(predictionsData);
        } catch (predError: any) {
          console.error('Failed to load predictions:', predError);
          // Don't set error state - predictions are optional
        } finally {
          if (mounted) setPredictionsLoading(false);
        }
      } catch (e: any) {
        setErr(e.message ?? "Failed to load best times");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimmerId]);

  // Keyboard shortcuts for toggling predictions (P key) and squad ranks (R key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea and no modifiers
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          setShowPredictions(prev => !prev);
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          setShowSquadRanks(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sorted = useMemo(() => {
    const copy = [...allBest];
    // Sort by time (fastest first)
    copy.sort((a, b) => a.timeSeconds - b.timeSeconds);
    return copy;
  }, [allBest]);

  const onCardPress = (it: BestTimeResult) => {
    setQuery({
      swimmerId,
      distance: it.distance,
      stroke: it.stroke,
      activity: it.activity,
      equipment: it.equipment,
      units: it.units,
      resultUnits: it.resultUnits || "",
    });
    setOpen(true);
  };

  const onEditResult = (it: BestTimeResult) => {
    setEditingResult(it);
    setAddEditOpen(true);
  };

  const onEditAttempt = async (attemptId: string) => {
    // Fetch the full workout result data for this attempt
    try {
      const data = await apiClient.get<any>(`/workout-results/${attemptId}`);

      if (data) {
        setEditingResult({
          id: data.id,
          distance: data.distance,
          stroke: data.stroke,
          activity: data.activity,
          equipment: data.equipment,
          units: data.units,
          timeResult: data.time_result,
          timeSeconds: 0, // Not needed for editing
          numberOfResults: 0, // Not needed for editing
          eventKey: '', // Not needed for editing
          performedOn: data.performed_on,
          resultUnits: data.result_units || "",
        });
        setOpen(false); // Close attempts modal
        setAddEditOpen(true); // Open edit modal
      }
    } catch (e: any) {
      setErr(e.message ?? 'Failed to load attempt data');
    }
  };

  const handleModalClose = () => {
    setAddEditOpen(false);
    setEditingResult(null);
  };

  return (
    <>
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
      {/* Header with Stats */}
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-linear-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-md shadow-cyan-500/25">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Personal Best Times</h2>
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-cyan-400">{sorted.length}</span>{' '}
                {sorted.length === 1 ? 'record' : 'records'} found
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Predictions Toggle */}
            <button
              onClick={() => setShowPredictions(!showPredictions)}
              className={`group px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                showPredictions
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                  : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60 hover:text-slate-300'
              }`}
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">{showPredictions ? 'Hide' : 'Show'}</span>
              <kbd className="hidden sm:inline-block px-1 py-0.5 text-[10px] bg-slate-900/50 rounded border border-slate-700/40 font-mono">
                P
              </kbd>
            </button>
            
            {/* Squad Ranks Toggle */}
            {swimmer?.squad_id && (
              <button
                onClick={() => setShowSquadRanks(!showSquadRanks)}
                disabled={squadBenchmarksLoading}
                className={`group px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  showSquadRanks
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60 hover:text-slate-300'
                } ${squadBenchmarksLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Users size={14} />
                <span className="hidden sm:inline">{squadBenchmarksLoading ? 'Loading...' : showSquadRanks ? 'Hide' : 'Show'}</span>
                <kbd className="hidden sm:inline-block px-1 py-0.5 text-[10px] bg-slate-900/50 rounded border border-slate-700/40 font-mono">
                  R
                </kbd>
              </button>
            )}
            
            {canManageResults && (
              <button
                onClick={() => setAddEditOpen(true)}
                className="group px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-105 active:scale-95 bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/30 ring-2 ring-cyan-500/50 flex items-center gap-2"
              >
                <Plus size={16} />
                Add Result
              </button>
            )}
          </div>
        </div>
      </div>



      {/* Error State */}
      {err && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-red-500/20 to-red-500/10 flex items-center justify-center text-red-400">
              <Activity size={20} />
            </div>
            <div>
              <strong className="block text-red-400 font-semibold mb-1">Error</strong>
              <p className="text-slate-400">{err}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/60 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-linear-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-5 bg-linear-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 rounded mb-2"></div>
                  <div className="h-4 w-2/3 bg-linear-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 rounded"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-linear-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 rounded"></div>
                <div className="h-4 w-3/4 bg-linear-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && sorted.length === 0 && (
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-12 shadow-lg text-center">
          <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6 text-cyan-400">
            <TrendingUp size={48} />
          </div>
          <h3 className="text-xl font-bold text-slate-100 mb-3">No Best Times Found</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            No personal records have been recorded yet.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && sorted.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-200">
          <GroupedBestTimesView
            bestTimes={sorted}
            canManageResults={canManageResults}
            onCardPress={onCardPress}
            onEditResult={onEditResult}
            swimmerDateOfBirth={swimmer?.date_of_birth}
            swimmerSex={swimmer?.sex}
            predictions={predictions}
            predictionsLoading={predictionsLoading}
            showPredictions={showPredictions}
            squadBenchmarks={squadBenchmarks}
            swimmerId={swimmerId}
            showSquadRanks={showSquadRanks}
            onToggleSquadRanks={() => setShowSquadRanks(prev => !prev)}
            squadBenchmarksLoading={squadBenchmarksLoading}
            onShowPredictionsGuide={() => setShowPredictionsGuide(true)}
          />
        </div>
      )}

      
    </div>
    
    {/* Attempts Modal */}
    {query && (
      <AttemptsModal
        open={open}
        onClose={() => setOpen(false)}
        query={query}
        onEditAttempt={onEditAttempt}
        canManageResults={canManageResults}
        onDeleteAttempt={refreshData}
      />
    )}

    {/* Add/Edit Workout Result Modal */}
    <AddEditWorkoutResultModal
      open={addEditOpen}
      onClose={handleModalClose}
      swimmerId={swimmerId}
      resultId={editingResult?.id}
      initialData={editingResult ? {
        distance: editingResult.distance,
        stroke: editingResult.stroke,
        activity: editingResult.activity,
        equipment: editingResult.equipment,
        units: editingResult.units,
        time_result: editingResult.timeResult,
        performed_on: editingResult.performedOn || undefined,
        result_units: editingResult.resultUnits,
      } : undefined}
      onSuccess={() => {
        refreshData();
        handleModalClose();
      }}
    />

    {/* Predictions Guide Modal */}
    <Modal
      isOpen={showPredictionsGuide}
      onClose={() => setShowPredictionsGuide(false)}
      title="Understanding AI Predictions"
      size="lg"
    >
      <div className="space-y-4">
        {/* Main explanation */}
        <div className="bg-linear-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-4 border border-cyan-500/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 mb-2">What does this predict?</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-3">
                AI predictions estimate what time a swimmer could achieve after <strong className="text-cyan-400">3 more training sessions</strong>, 
                based on their recent performance trend.
              </p>
              <p className="text-sm text-slate-400">
                Think of it as a realistic goal based on how they've been improving lately.
              </p>
            </div>
          </div>
        </div>

        {/* Simple example */}
        <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/40">
          <h4 className="font-semibold text-slate-100 mb-3">Example</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-400">Recent 100m Free times:</span>
              <span className="font-mono text-slate-300">62.5s → 61.2s → 60.5s</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Current best:</span>
              <span className="text-cyan-400 font-semibold">60.5s</span>
            </div>
            <div className="flex items-center justify-between py-2 bg-purple-500/10 -mx-4 px-4 rounded">
              <span className="text-slate-200 font-medium">Predicted next time:</span>
              <span className="text-purple-400 font-bold text-lg">59.3s</span>
            </div>
          </div>
        </div>

        {/* Key factors */}
        <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/40">
          <h4 className="font-semibold text-slate-100 mb-3">What affects the prediction?</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              <div>
                <span className="text-slate-300 font-medium">Recent performance:</span>
                <span className="text-slate-400 ml-1">How fast they're improving</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              <div>
                <span className="text-slate-300 font-medium">Training attendance:</span>
                <span className="text-slate-400 ml-1">Better attendance = better predictions</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              <div>
                <span className="text-slate-300 font-medium">Consistency:</span>
                <span className="text-slate-400 ml-1">How steady their times have been</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 mt-0.5">•</span>
              <div>
                <span className="text-slate-300 font-medium">Squad comparison:</span>
                <span className="text-slate-400 ml-1">How you're improving vs. training partners</span>
              </div>
            </div>
          </div>
        </div>

        {/* Confidence explained simply */}
        <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/40">
          <h4 className="font-semibold text-slate-100 mb-3">Confidence Level</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-16 px-2 py-1 bg-purple-500/20 rounded text-purple-400 text-xs font-semibold text-center">HIGH</div>
              <span className="text-slate-400">Lots of data, clear improvement trend</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 px-2 py-1 bg-blue-500/20 rounded text-blue-400 text-xs font-semibold text-center">MEDIUM</div>
              <span className="text-slate-400">Some data, reasonable prediction</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 px-2 py-1 bg-slate-500/20 rounded text-slate-400 text-xs font-semibold text-center">LOW</div>
              <span className="text-slate-400">Limited data, take with caution</span>
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-sm text-blue-200">
            💡 Use predictions to set short-term goals and track if training is working.
          </p>
        </div>
      </div>
    </Modal>
    </>
  );
}