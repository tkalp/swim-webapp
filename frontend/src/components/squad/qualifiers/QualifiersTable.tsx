import { QualificationCell } from './QualificationCell';

type Swimmer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
};

type BestTimeResult = {
  timeSeconds: number;
  distance: number;
  stroke: string;
  resultUnits: string;
  activity?: string;
  equipment?: string;
};

type EventKey = {
  distance: number;
  stroke: string;
  poolType: string;
};

type SwimmerQualification = {
  swimmer: Swimmer;
  age: number;
  bestTimes: Map<string, BestTimeResult>;
  qualifiedCount: number;
  closeCount: number;
};

const STROKE_LABELS: Record<string, string> = {
  free: 'Free',
  back: 'Back',
  breast: 'Breast',
  fly: 'Fly',
  im: 'IM',
};

type QualificationTier = 'elite' | 'strong' | 'developing' | 'emerging' | 'beginner';

function getQualificationTier(qualifiedCount: number, totalEvents: number): QualificationTier {
  const percentage = totalEvents > 0 ? (qualifiedCount / totalEvents) * 100 : 0;
  
  if (percentage >= 80) return 'elite';
  if (percentage >= 60) return 'strong';
  if (percentage >= 40) return 'developing';
  if (percentage > 0) return 'emerging';
  return 'beginner';
}

const TIER_CONFIG = {
  elite: {
    label: 'Elite',
    colors: 'from-emerald-500/20 to-emerald-500/5',
    borderColor: 'border-emerald-500/50',
    textColor: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20',
    progressBar: 'from-emerald-500 to-emerald-400',
    showStar: true,
  },
  strong: {
    label: 'Strong',
    colors: 'from-cyan-500/20 to-cyan-500/5',
    borderColor: 'border-cyan-500/50',
    textColor: 'text-cyan-300',
    badgeBg: 'bg-cyan-500/20',
    progressBar: 'from-cyan-500 to-cyan-400',
    showStar: false,
  },
  developing: {
    label: 'Developing',
    colors: 'from-amber-500/20 to-amber-500/5',
    borderColor: 'border-amber-500/50',
    textColor: 'text-amber-300',
    badgeBg: 'bg-amber-500/20',
    progressBar: 'from-amber-500 to-amber-400',
    showStar: false,
  },
  emerging: {
    label: 'Emerging',
    colors: 'from-purple-500/20 to-purple-500/5',
    borderColor: 'border-purple-500/50',
    textColor: 'text-purple-300',
    badgeBg: 'bg-purple-500/20',
    progressBar: 'from-purple-500 to-purple-400',
    showStar: false,
  },
  beginner: {
    label: 'Beginner',
    colors: 'from-slate-500/20 to-slate-500/5',
    borderColor: 'border-slate-500/50',
    textColor: 'text-slate-400',
    badgeBg: 'bg-slate-500/20',
    progressBar: 'from-slate-500 to-slate-400',
    showStar: false,
  },
};

interface QualifiersTableProps {
  swimmers: SwimmerQualification[];
  events: EventKey[];
  getStandardTime: (distance: number, stroke: string, poolType: string, age: number, sex: string) => number | null;
  formatTime: (seconds: number) => string;
}

export function QualifiersTable({ swimmers, events, getStandardTime, formatTime }: QualifiersTableProps) {
  if (swimmers.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-slate-800/50 p-8 text-center">
        <p className="text-slate-500">No swimmers match your filters</p>
      </div>
    );
  }

  // Sort swimmers by qualification count (descending)
  const sortedSwimmers = [...swimmers].sort((a, b) => b.qualifiedCount - a.qualifiedCount);

  return (
    <div className="bg-linear-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-linear-to-r from-slate-800/90 via-slate-900/90 to-slate-800/90 border-b border-cyan-500/30 sticky top-0 z-10 backdrop-blur-xl">
            <tr>
              <th className="text-left px-4 py-4 text-xs font-bold uppercase tracking-wider sticky left-0 z-20">
                <span className="text-transparent bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text">Swimmer</span>
              </th>
              <th className="text-center px-2 py-4 text-xs font-bold uppercase tracking-wider">
                <span className="text-transparent bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text">Age</span>
              </th>
              {events.map(event => (
                <th
                  key={`${event.distance}-${event.stroke}-${event.poolType}`}
                  className="text-center px-2 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap hover:text-cyan-400 transition-colors"
                >
                  {event.distance} {STROKE_LABELS[event.stroke]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSwimmers.map((sq, idx) => {
              const tier = getQualificationTier(sq.qualifiedCount, events.length);
              const tierConfig = TIER_CONFIG[tier];
              const qualificationPercentage = events.length > 0 ? (sq.qualifiedCount / events.length) * 100 : 0;

              return (
                <tr
                  key={sq.swimmer.id}
                  className={`group border-b border-slate-700/30 hover:bg-linear-to-r hover:${tierConfig.colors} transition-all duration-300`}
                >
                  {/* Swimmer Name */}
                  <td className="px-2 sm:px-4 py-2 sm:py-3 sticky left-0 bg-slate-900/95 group-hover:bg-linear-to-r group-hover:from-slate-800/95 group-hover:via-slate-900/95 group-hover:to-slate-900/95 z-10 transition-all duration-300">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-linear-to-br ${tierConfig.colors} flex items-center justify-center border-2 ${tierConfig.borderColor} group-hover:scale-110 transition-all duration-300 shadow-lg shrink-0`}>
                        <span className={`text-xs font-bold ${tierConfig.textColor}`}>
                          {sq.swimmer.first_name[0]}{sq.swimmer.last_name[0]}
                        </span>
                        {tierConfig.showStar && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-xs text-white">★</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <p className={`text-xs sm:text-sm font-semibold ${tierConfig.textColor} transition-colors truncate`}>
                            {sq.swimmer.first_name} {sq.swimmer.last_name}
                          </p>
                          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium ${tierConfig.badgeBg} ${tierConfig.textColor} border ${tierConfig.borderColor} whitespace-nowrap`}>
                            {tierConfig.label}
                          </span>
                          <span className="sm:hidden text-xs text-slate-500 font-medium">
                            ({sq.age})
                          </span>
                        </div>
                        <div className="mt-1">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="flex-1 h-1 sm:h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                              <div 
                                className={`h-full bg-linear-to-r ${tierConfig.progressBar} transition-all duration-500`}
                                style={{ width: `${qualificationPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 font-medium min-w-8 sm:min-w-12 text-right">
                              {qualificationPercentage.toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 group-hover:text-slate-400 mt-0.5">
                            <span className="text-emerald-400">{sq.qualifiedCount} qualified</span> • <span className="text-amber-400">{sq.closeCount} close</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>

                {/* Age */}
                <td className="hidden sm:table-cell px-2 py-3 text-center">
                  <span className="text-sm text-slate-400">{sq.age}</span>
                </td>

                {/* Event Qualifications */}
                {events.map(event => {
                  const key = `${event.distance}-${event.stroke}-${event.poolType}`;
                  const bestTime = sq.bestTimes.get(key);
                  const standardTime = getStandardTime(
                    event.distance,
                    event.stroke,
                    event.poolType,
                    sq.age,
                    sq.swimmer.sex
                  );

                  let percentageGap = null;
                  if (bestTime && standardTime) {
                    percentageGap = ((bestTime.timeSeconds - standardTime) / standardTime) * 100;
                  }

                  return (
                    <td key={key} className="px-1 sm:px-2 py-2 sm:py-3">
                      <QualificationCell
                        swimmerBestTime={bestTime?.timeSeconds ?? null}
                        standardTime={standardTime ?? 0}
                        percentageGap={percentageGap}
                      />
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
