import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Target, Zap, Wrench } from 'lucide-react';

interface AnalyticsDashboardProps {
  energyZoneBreakdown?: Record<string, number>;
  energyZonePercentages?: Record<string, number>;
  intensityBreakdown?: Record<string, number>;
  equipmentBreakdown?: Record<string, number>;
}

// Energy zone colors
const ENERGY_ZONE_COLORS: Record<string, string> = {
  '1': '#3B82F6', // blue-500
  '2': '#10B981', // green-500
  '3': '#FBBF24', // yellow-400
  '4': '#F97316', // orange-500
  '5': '#EF4444', // red-500
};

// Intensity colors
const INTENSITY_COLORS: Record<string, string> = {
  easy: '#10B981',
  moderate: '#FBBF24',
  hard: '#F97316',
  sprint: '#EF4444',
};

// Equipment colors
const EQUIPMENT_COLORS = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#A78BFA'];

export default function AnalyticsDashboard({
  energyZoneBreakdown,
  energyZonePercentages,
  intensityBreakdown,
  equipmentBreakdown,
}: AnalyticsDashboardProps) {
  
  // Prepare energy zone data
  const energyZoneData = energyZoneBreakdown 
    ? Object.entries(energyZoneBreakdown)
        .filter(([_, value]) => value > 0)
        .map(([zone, distance]) => ({
          name: `Zone ${zone}`,
          value: distance,
          percentage: energyZonePercentages?.[zone] || 0,
          zone: parseInt(zone),
        }))
    : [];

  // Prepare intensity data
  const intensityData = intensityBreakdown
    ? Object.entries(intensityBreakdown)
        .filter(([_, value]) => value > 0)
        .map(([level, distance]) => ({
          name: level.charAt(0).toUpperCase() + level.slice(1),
          value: distance,
        }))
    : [];

  // Prepare equipment data
  const equipmentData = equipmentBreakdown
    ? Object.entries(equipmentBreakdown)
        .filter(([_, value]) => value > 0)
        .map(([equipment, distance]) => ({
          name: equipment.charAt(0).toUpperCase() + equipment.slice(1),
          value: distance,
        }))
    : [];

  const hasEnergyZones = energyZoneData.length > 0;
  const hasIntensity = intensityData.length > 0;
  const hasEquipment = equipmentData.length > 0;

  if (!hasEnergyZones && !hasIntensity && !hasEquipment) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p>No advanced analytics available for this workout</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Energy Zone Distribution */}
      {hasEnergyZones && (
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <Target size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Energy Zones</h3>
              <p className="text-xs text-slate-400">Training intensity distribution</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={energyZoneData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {energyZoneData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ENERGY_ZONE_COLORS[entry.zone.toString()]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
                        <p className="text-white font-semibold">{data.name}</p>
                        <p className="text-slate-300 text-sm">{data.value}m ({data.percentage.toFixed(1)}%)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {energyZoneData.map((zone, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ENERGY_ZONE_COLORS[zone.zone.toString()] }}
                  />
                  <span className="text-slate-300">{zone.name}</span>
                </div>
                <span className="text-white font-semibold">{zone.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intensity Breakdown */}
      {hasIntensity && (
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <Zap size={20} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Intensity</h3>
              <p className="text-xs text-slate-400">Effort level breakdown</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={intensityData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} width={70} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
                        <p className="text-white font-semibold">{payload[0].payload.name}</p>
                        <p className="text-slate-300 text-sm">{payload[0].value}m</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {intensityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={INTENSITY_COLORS[entry.name.toLowerCase()] || '#06B6D4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {intensityData.map((level, idx) => {
              const total = intensityData.reduce((sum, item) => sum + item.value, 0);
              const percentage = ((level.value / total) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: INTENSITY_COLORS[level.name.toLowerCase()] || '#06B6D4' }}
                    />
                    <span className="text-slate-300">{level.name}</span>
                  </div>
                  <span className="text-white font-semibold">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Equipment Usage */}
      {hasEquipment && (
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Wrench size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Equipment</h3>
              <p className="text-xs text-slate-400">Training aids used</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={equipmentData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {equipmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={EQUIPMENT_COLORS[index % EQUIPMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
                        <p className="text-white font-semibold">{payload[0].payload.name}</p>
                        <p className="text-slate-300 text-sm">{payload[0].value}m</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {equipmentData.map((equip, idx) => {
              const total = equipmentData.reduce((sum, item) => sum + item.value, 0);
              const percentage = ((equip.value / total) * 100).toFixed(1);
              return (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: EQUIPMENT_COLORS[idx % EQUIPMENT_COLORS.length] }}
                    />
                    <span className="text-slate-300">{equip.name}</span>
                  </div>
                  <span className="text-white font-semibold">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
