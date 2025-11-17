import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSquadPermissions } from "../hooks/useSquadPermissions";

import AttendanceChart from "../components/charts/AttendanceChart";
import SessionsPerWeekChart from "../components/charts/SessionsPerWeekChart";
import SwimmerOverviewStats from "../components/stats/SwimmerOverviewStats";
import RangeToolbar from "../components/range/RangeToolbar";
import BestTimesTab from "../components/swimmers/BestTimesTab";
import SwimmerProfileCard from "../components/swimmers/SwimmerProfileCard";

import type { RangeKey } from "../types/stats";
import { useSwimmerStats } from "../hooks/useSwimmerStats";
import { presetRange, formatRangeSubtitle } from "../utils/dateRanges";
import PageHeader from "../components/ui/PageHeader";


const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'bestTimes', label: 'Records' },
];

export default function SwimmerPage() {
  const { swimmerId } = useParams<{ swimmerId: string }>();

  // range state
  const [rangeKey, setRangeKey] = useState<RangeKey>("all_time");
  const initial = presetRange("all_time");
  const [from, setFrom] = useState<string | undefined>(initial.from);
  const [to, setTo] = useState<string | undefined>(initial.to);

  // data
  const {
    loading,
    err,
    attendance,
    sessions,
    totalAttendance,
    presentPct,
    attendanceData,
    avgPerWeek,
    bestWeek,
    swimmer,
  } = useSwimmerStats(swimmerId, { from, to });

  // Fetch squad_id from swimmer to check permissions
  const [squadId, setSquadId] = useState<string | null>(null);
  const { hasPermission } = useSquadPermissions(squadId || '');

  useEffect(() => {
    if (swimmer?.squad_id) {
      setSquadId(swimmer.squad_id);
    }
  }, [swimmer]);

  // UI state
  const [tab, setTab] = useState("overview");

  const rangeSubtitle = useMemo(
    () => formatRangeSubtitle(from, to),
    [from, to]
  );

  // handlers
  const onQuick = (key: RangeKey) => {
    setRangeKey(key);
    const p = presetRange(key);
    setFrom(p.from);
    setTo(p.to);
  };
  const onApplyCustom = () => setRangeKey("custom");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-primary via-background-primary to-background-secondary/30">
      <PageHeader
        title={swimmer ? `${swimmer.first_name} ${swimmer.last_name}` : "Swimmer Stats"}
        backLabel="Swimmers"
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
        {err && (
          <div className="fixed top-20 right-4 sm:right-6 bg-background-elevated border border-danger rounded-xl p-3 shadow-lg flex items-start gap-2 max-w-[90vw] sm:max-w-md z-[1000] animate-in slide-in-from-right duration-300">
            <div className="flex-1">
              <strong className="block text-danger text-sm font-semibold mb-1">
                Error
              </strong>
              <p className="m-0 text-text-secondary text-xs leading-relaxed break-words">
                {err}
              </p>
            </div>
          </div>
        )}

        {swimmer && <SwimmerProfileCard swimmer={swimmer} />}

        {tab === "overview" && (
          <div className="space-y-3">
            <RangeToolbar
              rangeKey={rangeKey}
              from={from}
              to={to}
              onQuick={onQuick}
              onChangeFrom={setFrom}
              onChangeTo={setTo}
              onApplyCustom={onApplyCustom}
            />

            {loading && (
              <div className="space-y-3">
                {/* Loading skeleton for stats */}
                <div className="flex flex-wrap gap-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex-1 min-w-[150px] p-4 bg-background-elevated rounded-xl border border-border/60 animate-pulse">
                      <div className="h-3 bg-background-tertiary rounded mb-2"></div>
                      <div className="h-6 bg-background-tertiary rounded mb-2"></div>
                      <div className="h-2 w-2/3 bg-background-tertiary rounded"></div>
                    </div>
                  ))}
                </div>
                
                {/* Loading skeleton for charts */}
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="flex-1 p-4 bg-background-elevated rounded-xl border border-border/60 animate-pulse">
                    <div className="h-5 bg-background-tertiary rounded mb-3"></div>
                    <div className="h-48 bg-background-tertiary rounded"></div>
                  </div>
                  <div className="flex-1 p-4 bg-background-elevated rounded-xl border border-border/60 animate-pulse">
                    <div className="h-5 bg-background-tertiary rounded mb-3"></div>
                    <div className="h-48 bg-background-tertiary rounded"></div>
                  </div>
                </div>
              </div>
            )}

            {!loading && (
              <div className="space-y-3">
                <SwimmerOverviewStats
                  presentPct={presentPct}
                  attendance={attendance}
                  totalAttendance={totalAttendance}
                  avgPerWeek={avgPerWeek}
                  weeksInRange={sessions.length}
                />

                <div className="flex flex-col xl:flex-row gap-3">
                  <div className="flex-1 bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                    <AttendanceChart
                      data={attendanceData}
                      subtitle={rangeSubtitle}
                    />
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-background-elevated to-background-secondary/50 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                    <SessionsPerWeekChart data={sessions} bestWeek={bestWeek} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && tab === "bestTimes" && swimmerId && (
          <div className="animate-in fade-in slide-in-from-bottom duration-500">
            <BestTimesTab 
              swimmerId={swimmerId} 
              swimmer={swimmer}
              canManageResults={hasPermission('can_manage_results')}
            />
          </div>
        )}
      </main>
    </div>
  );
}
