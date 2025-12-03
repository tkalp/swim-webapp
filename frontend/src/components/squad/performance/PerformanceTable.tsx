import React, { useState, useMemo } from "react";
import { SwimmerPerformance } from "@/services/metricsService";
import { SwimmerRow } from "@/components/squad/performance/SwimmerRow";
import { MetricsHelpModal } from "@/components/squad/performance/MetricsHelpModal";
import {
  Search,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  Minus,
  HelpCircle,
} from "lucide-react";

interface PerformanceTableProps {
  swimmers: SwimmerPerformance[];
  expandedSwimmerId: string | null;
  onToggleExpanded: (swimmerId: string) => void;
}

type SortField =
  | "name"
  | "events"
  | "prs"
  | "best_improvement"
  | "avg_improvement"
  | "weighted_improvement"
  | "consistency";
type SortDirection = "asc" | "desc";
type FilterStatus = "all" | "improving" | "stable" | "regressing";

export const PerformanceTable: React.FC<PerformanceTableProps> = ({
  swimmers,
  expandedSwimmerId,
  onToggleExpanded,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("weighted_improvement");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedSwimmers = useMemo(() => {
    let result = [...swimmers];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.swimmer_name.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== "all") {
      result = result.filter((s) => {
        const weighted = s.weighted_improvement_pct || 0;
        if (filterStatus === "improving") return weighted < -1;
        if (filterStatus === "stable") return weighted >= -1 && weighted <= 1;
        if (filterStatus === "regressing") return weighted > 1;
        return true;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "name":
          aVal = a.swimmer_name.toLowerCase();
          bVal = b.swimmer_name.toLowerCase();
          break;
        case "events":
          aVal = a.events_analyzed;
          bVal = b.events_analyzed;
          break;
        case "prs":
          aVal = a.personal_records;
          bVal = b.personal_records;
          break;
        case "best_improvement":
          aVal = a.best_improvement_pct;
          bVal = b.best_improvement_pct;
          break;
        case "avg_improvement":
          aVal = a.avg_improvement_pct;
          bVal = b.avg_improvement_pct;
          break;
        case "weighted_improvement":
          aVal = a.weighted_improvement_pct || 0;
          bVal = b.weighted_improvement_pct || 0;
          break;
        case "consistency":
          aVal = a.consistency_score || 0;
          bVal = b.consistency_score || 0;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [swimmers, searchQuery, sortField, sortDirection, filterStatus]);

  if (swimmers.length === 0) {
    return (
      <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50">
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/60">
          <h3 className="text-lg font-bold text-cyan-400">
            Swimmer Performance Breakdown
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Click on a swimmer to view event details
          </p>
        </div>
        <div className="p-12 text-center">
          <p className="text-slate-400 font-medium">
            No performance data available for the selected date range.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Try adjusting the date range or ensure swimmers have logged
            workouts.
          </p>
        </div>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDirection === "asc" ? (
      <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
    ) : (
      <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
    );
  };

  return (
    <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-700/50">
      {/* Header with Controls */}
      <div className="p-6 border-b-2 border-slate-700/40 bg-linear-to-r from-slate-800/60 to-slate-800/40 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">
              Swimmer Performance Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {filteredAndSortedSwimmers.length} of {swimmers.length} swimmers
            </p>
          </div>
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Metrics Guide</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search swimmers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
            />
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            {(
              ["all", "improving", "stable", "regressing"] as FilterStatus[]
            ).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  filterStatus === status
                    ? status === "improving"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                      : status === "stable"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                      : status === "regressing"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                      : "bg-slate-600/50 text-slate-200 border border-slate-500/50"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/50"
                }`}
              >
                {status === "all" && (
                  <span className="flex items-center gap-1.5">All</span>
                )}
                {status === "improving" && (
                  <span className="flex items-center gap-1.5">
                    <TrendingDown className="w-3 h-3" />
                    Improving
                  </span>
                )}
                {status === "stable" && (
                  <span className="flex items-center gap-1.5">
                    <Minus className="w-3 h-3" />
                    Stable
                  </span>
                )}
                {status === "regressing" && (
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" />
                    Regressing
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50">
            <tr className="text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <th
                className="px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  Swimmer
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:bg-slate-700/30 transition-colors"
                onClick={() => handleSort("events")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Events
                  <SortIcon field="events" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:bg-slate-700/30 transition-colors"
                onClick={() => handleSort("prs")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  PRs
                  <SortIcon field="prs" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:bg-slate-700/30 transition-colors hidden xl:table-cell"
                onClick={() => handleSort("avg_improvement")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Avg Improvement
                  <SortIcon field="avg_improvement" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:bg-slate-700/30 transition-colors hidden lg:table-cell"
                onClick={() => handleSort("best_improvement")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Best Improvement
                  <SortIcon field="best_improvement" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:bg-slate-700/30 transition-colors hidden md:table-cell"
                onClick={() => handleSort("consistency")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Consistency
                  <SortIcon field="consistency" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-center cursor-pointer hover:bg-slate-700/30 transition-colors"
                onClick={() => handleSort("weighted_improvement")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Weighted Improvement
                  <SortIcon field="weighted_improvement" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {filteredAndSortedSwimmers.map((swimmer, index) => (
              <SwimmerRow
                key={swimmer.swimmer_id}
                swimmer={swimmer}
                isExpanded={expandedSwimmerId === swimmer.swimmer_id}
                onToggle={() => onToggleExpanded(swimmer.swimmer_id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedSwimmers.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-slate-400">No swimmers match your filters</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setFilterStatus("all");
            }}
            className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      <MetricsHelpModal 
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
};
