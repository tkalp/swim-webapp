// components/swimmers/FinaPointsTab.tsx
import { useState } from "react";
import FinaPointsRadarChart from '@/components/swimmers/bestTimes/FinaPointsRadarChart';

type Swimmer = {
  first_name?: string;
  last_name?: string;
  sex?: string;
};

interface FinaPointsTabProps {
  swimmerId: string;
  swimmer?: Swimmer;
}

export default function FinaPointsTab({ swimmerId, swimmer }: FinaPointsTabProps) {
  const gender = swimmer?.sex === "Female" ? "female" : swimmer?.sex === "Male" ? "male" : null;
  const [finaCourse, setFinaCourse] = useState<"LCM" | "SCM">("LCM");

  if (!gender) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-slate-400 text-sm">
          FINA points unavailable — swimmer gender not set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
      {/* Pool Type Selector */}
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 p-4 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 mb-1">Pool Type</h3>
            <p className="text-xs text-slate-400">
              Select pool type for FINA points calculation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={finaCourse}
              onChange={(e) => setFinaCourse(e.target.value as "LCM" | "SCM")}
              className="px-4 py-2 text-sm rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 hover:border-cyan-500/50 transition-all duration-200"
            >
              <option value="LCM">LCM (50m)</option>
              <option value="SCM">SCM (25m)</option>
            </select>
          </div>
        </div>
      </div>

      {/* FINA Points Radar Chart */}
      <FinaPointsRadarChart
        swimmerId={swimmerId}
        gender={gender}
        course={finaCourse}
      />
    </div>
  );
}
