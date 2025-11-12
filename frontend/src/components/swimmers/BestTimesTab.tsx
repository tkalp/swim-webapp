// components/swimmer/BestTimesTab.tsx
import { useEffect, useMemo, useState } from "react";
import {
  getSwimmerBestTimes,
  type BestTimeResult,
  type EventQuery,
} from "../../features/swimmers/bestTimesApi";
import GroupedBestTimesView from "./bestTimes/GroupedBestTimesView";
import AttemptsModal from "./bestTimes/AttemptsModal";
import AddEditWorkoutResultModal from "./bestTimes/AddEditWorkoutResultModal";
import SwimRankingsLink from "./SwimRankingsLink";
import type { Option } from "../ui/CustomSelect";
import CustomSelect from "../ui/CustomSelect";
import { supabase } from "../../lib/supabase";
import { Activity, TrendingUp, Filter, RotateCcw, Plus } from "lucide-react";

type SortOption = "time" | "event" | "date";
type Filters = { activity?: string; resultUnits?: string; stroke?: string; distance?: number };

type Swimmer = {
  first_name?: string;
  last_name?: string;
};

export default function BestTimesTab({ swimmerId, swimmer }: { swimmerId: string; swimmer?: Swimmer }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [allBest, setAllBest] = useState<BestTimeResult[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [sortBy, setSortBy] = useState<SortOption>("time");
  const [selectedStroke, setSelectedStroke] = useState<string>("all");

  const [query, setQuery] = useState<EventQuery | null>(null);
  const [open, setOpen] = useState(false);
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<BestTimeResult | null>(null);

  const refreshData = () => {
    setLoading(true);
    (async () => {
      try {
        const data = await getSwimmerBestTimes(swimmerId);
        setAllBest(data);
        setErr("");
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
      } catch (e: any) {
        setErr(e.message ?? "Failed to load best times");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [swimmerId]);

  const filtered = useMemo(() => {
    let result = allBest.filter((r) => {
      if (filters.activity && r.activity !== filters.activity) return false;
      if (filters.resultUnits && r.resultUnits !== filters.resultUnits) return false;
      if (filters.stroke && r.stroke !== filters.stroke) return false;
      if (filters.distance && r.distance !== filters.distance) return false;
      return true;
    });

    // Apply stroke tab filter
    if (selectedStroke !== "all") {
      result = result.filter(r => r.stroke === selectedStroke);
    }

    return result;
  }, [allBest, filters, selectedStroke]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortBy === "time") copy.sort((a, b) => a.timeSeconds - b.timeSeconds);
    else if (sortBy === "event")
      copy.sort(
        (a, b) => a.distance - b.distance || a.stroke.localeCompare(b.stroke)
      );
    else
      copy.sort(
        (a, b) =>
          new Date(b.performedOn ?? 0).getTime() -
          new Date(a.performedOn ?? 0).getTime()
      );
    return copy;
  }, [filtered, sortBy]);

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
      const { data, error } = await supabase
        .from('workout_result')
        .select('*')
        .eq('id', attemptId)
        .single();
      
      if (error) throw error;
      
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

  const hasActiveFilters = filters.activity || filters.resultUnits || filters.stroke || filters.distance;

  // Get available strokes from data
  const availableStrokes = useMemo(() => {
    const strokes = new Set(allBest.map(r => r.stroke));
    return Array.from(strokes).sort();
  }, [allBest]);

  // Common distances for quick filters
  const commonDistances = [50, 100, 200, 400, 800, 1500];
  const availableDistances = useMemo(() => {
    const distances = new Set(allBest.map(r => r.distance));
    return commonDistances.filter(d => distances.has(d));
  }, [allBest]);

  const strokeOptions: Option[] = [
    { value: "", label: "All Strokes" },
    { value: "free", label: "Freestyle" },
    { value: "back", label: "Backstroke" },
    { value: "breast", label: "Breaststroke" },
    { value: "fly", label: "Butterfly" },
    { value: "im", label: "IM" },
  ];
  const activityOptions: Option[] = [
    { value: "", label: "All Activities" },
    { value: "swim", label: "Swim" },
    { value: "kick", label: "Kick" },
    { value: "pull", label: "Pull" },
  ];
  const resultUnitsOptions: Option[] = [
    { value: "", label: "All Pool Types" },
    { value: "SCM", label: "SCM" },
    { value: "LCM", label: "LCM" },
    { value: "SCY", label: "SCY" },
  ];

  const sortOptions: Option[] = [
    { value: "time", label: "Best Time" },
    { value: "event", label: "Event" },
    { value: "date", label: "Most Recent" },
  ];

  return (
    <>
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
      {/* External Tracking Integration */}
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg">
        <SwimRankingsLink
          swimmerId={swimmerId}
          firstName={swimmer?.first_name}
          lastName={swimmer?.last_name}
        />
      </div>

      {/* Header with Stats */}
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-6 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center shadow-md shadow-accent/25">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Personal Best Times</h2>
              <p className="text-xs text-text-tertiary">
                <span className="font-semibold text-accent">{sorted.length}</span>{' '}
                {sorted.length === 1 ? 'record' : 'records'} found
              </p>
            </div>
          </div>
          <button
            onClick={() => setAddEditOpen(true)}
            className="group px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/30 ring-2 ring-primary/50 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Result
          </button>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
        {/* Stroke Tabs */}
        <div className="mb-4 pb-4 border-b border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-primary rounded-lg flex items-center justify-center shadow-md shadow-accent/25">
              <Filter className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text-primary">Filter by Stroke</h3>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStroke("all")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                selectedStroke === "all"
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-md"
                  : "bg-background-tertiary/50 text-text-secondary hover:bg-background-secondary hover:text-text-primary"
              }`}
            >
              All Strokes
            </button>
            {availableStrokes.map(stroke => (
              <button
                key={stroke}
                onClick={() => setSelectedStroke(stroke)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  selectedStroke === stroke
                    ? "bg-gradient-to-r from-primary to-accent text-white shadow-md"
                    : "bg-background-tertiary/50 text-text-secondary hover:bg-background-secondary hover:text-text-primary"
                }`}
              >
                {strokeOptions.find(s => s.value === stroke)?.label || stroke}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Quick Filters */}
        {availableDistances.length > 0 && (
          <div className="mb-4 pb-4 border-b border-border/50">
            <h4 className="text-xs font-semibold text-text-tertiary mb-2 uppercase tracking-wider">Quick Distance Filter</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, distance: undefined }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !filters.distance
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-background-tertiary/30 text-text-muted hover:text-text-primary"
                }`}
              >
                All
              </button>
              {availableDistances.map(distance => (
                <button
                  key={distance}
                  onClick={() => setFilters(f => ({ ...f, distance }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filters.distance === distance
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-background-tertiary/30 text-text-muted hover:text-text-primary"
                  }`}
                >
                  {distance}m
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CustomSelect
            label="Activity"
            value={filters.activity ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, activity: v || undefined }))}
            options={activityOptions}
            placeholder="All Activities"
          />

          <CustomSelect
            label="Pool Type"
            value={filters.resultUnits ?? ""}
            onChange={(v) => setFilters((f) => ({ ...f, resultUnits: v || undefined }))}
            options={resultUnitsOptions}
            placeholder="All Pool Types"
          />

          <CustomSelect
            label="Sort By"
            value={sortBy}
            onChange={(v) => setSortBy(v as SortOption)}
            options={sortOptions}
          />
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button 
              className="group px-3 py-1.5 rounded-lg font-medium text-xs transition-all duration-200 hover:scale-105 active:scale-95 bg-background-tertiary/80 text-text-secondary hover:bg-background-secondary hover:text-text-primary hover:shadow-sm border border-border/30 flex items-center gap-2"
              onClick={() => {
                setFilters({});
                setSelectedStroke("all");
              }}
            >
              <RotateCcw size={14} />
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {err && (
        <div className="bg-background-card border border-danger/30 rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-danger/20 to-danger/10 flex items-center justify-center text-danger">
              <Activity size={20} />
            </div>
            <div>
              <strong className="block text-danger font-semibold mb-1">Error</strong>
              <p className="text-text-secondary">{err}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-background-card rounded-2xl p-6 border border-border animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded mb-2"></div>
                  <div className="h-4 w-2/3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded"></div>
                <div className="h-4 w-3/4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && sorted.length === 0 && (
        <div className="bg-background-card backdrop-blur-sm border border-border rounded-2xl p-12 shadow-lg text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6 text-primary">
            <TrendingUp size={48} />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-3">No Best Times Found</h3>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            {hasActiveFilters
              ? "Try adjusting your filters to see more results."
              : "No personal records have been recorded yet."}
          </p>
          {hasActiveFilters && (
            <button 
              className="px-6 py-3 bg-gradient-to-r from-primary-dark via-primary to-accent text-white rounded-lg font-medium hover:scale-105 hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center gap-2 mx-auto"
              onClick={() => setFilters({})}
            >
              <RotateCcw size={16} />
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {!loading && sorted.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom duration-500 delay-200">
          <GroupedBestTimesView
            bestTimes={sorted}
            sortBy={sortBy}
            onCardPress={onCardPress}
            onEditResult={onEditResult}
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
    </>
  );
}