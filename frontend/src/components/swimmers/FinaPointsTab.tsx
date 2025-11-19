// components/swimmers/FinaPointsTab.tsx
import { useState } from "react";
import FinaPointsRadarChart from "./bestTimes/FinaPointsRadarChart";

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
  const gender = swimmer?.sex === "Female" ? "female" : "male";
  const [finaCourse, setFinaCourse] = useState<"LCM" | "SCM">("LCM");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
      {/* Pool Type Selector */}
      <div className="bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-xl border border-border/60 p-4 backdrop-blur-sm shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Pool Type</h3>
            <p className="text-xs text-text-tertiary">
              Select pool type for FINA points calculation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={finaCourse}
              onChange={(e) => setFinaCourse(e.target.value as "LCM" | "SCM")}
              className="px-4 py-2 text-sm rounded-lg bg-background-secondary border border-border/40 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 hover:border-accent/50 transition-colors"
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
