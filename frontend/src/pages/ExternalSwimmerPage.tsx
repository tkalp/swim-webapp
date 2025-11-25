import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Globe,
  Award,
  ExternalLink,
  Loader2,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import {
  getExternalSwimmerFinaPoints,
  type SwimRankingsSearchResult,
  type ExternalSwimmerFinaPoints,
  type ExternalSwimmerBestTime,
} from '@/services/swimRankingsService';
import { 
  createSwimmerWithExternalLink, 
  getSwimmerSyncStatus,
  type SwimmerSyncStatus 
} from '@/services/swimmerService';
import AddToSquadModal from '@/components/swimmers/AddToSquadModal';

export default function ExternalSwimmerPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const swimmer = location.state?.swimmer as SwimRankingsSearchResult | undefined;
  const athleteId = swimmer?.athlete_id;

  const [finaData, setFinaData] = useState<ExternalSwimmerFinaPoints | null>(null);
  const [course, setCourse] = useState<'LCM' | 'SCM'>('LCM');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddToSquad, setShowAddToSquad] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SwimmerSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!swimmer || !athleteId) {
      navigate('/');
      return;
    }

    loadFinaData();
  }, [swimmer, athleteId, course]);

  const loadFinaData = async () => {
    if (!athleteId || !swimmer) return;

    setIsLoading(true);
    setError(null);

    try {
      const gender = swimmer.gender?.toUpperCase().startsWith('M') ? 'M' : 'F';
      const data = await getExternalSwimmerFinaPoints(athleteId, gender, course);
      setFinaData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load swimmer data');
    } finally {
      setIsLoading(false);
    }
  };

  if (!swimmer) {
    return null;
  }

  const handleAddToSquad = async (squadId: string) => {
    if (!swimmer) return;

    // Parse gender from swimmer data (M/F)
    const gender = swimmer.gender?.toUpperCase() === 'FEMALE' || swimmer.gender?.toUpperCase() === 'F' 
      ? 'Female' 
      : swimmer.gender?.toUpperCase() === 'MALE' || swimmer.gender?.toUpperCase() === 'M' 
      ? 'Male' 
      : 'Other';

    // Split name into first and last, capitalize properly, and remove commas
    const nameParts = swimmer.name.split(' ');
    const firstName = nameParts.pop() || '';
    const lastName = nameParts.join(' ');

    // Helper function to capitalize first letter and lowercase the rest
    const capitalizeProper = (name: string) => {
      return name
        .replace(/,/g, '') // Remove commas
        .trim()
        .split(' ')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    };

    const result = await createSwimmerWithExternalLink(
      {
        first_name: capitalizeProper(firstName),
        last_name: capitalizeProper(lastName),
        sex: gender,
        squad_id: squadId,
        date_of_birth: swimmer.birth_year ? `${swimmer.birth_year}-01-01` : null,
      },
      {
        platform: 'swimrankings',
        external_id: swimmer.athlete_id,
        external_url: `https://www.swimrankings.net/index.php?page=athleteDetail&athleteId=${swimmer.athlete_id}`,
        external_name: swimmer.name,
        birth_year: swimmer.birth_year ? parseInt(swimmer.birth_year) : undefined,
        nation_code: swimmer.nation,
        club_name: swimmer.club,
        gender: swimmer.gender?.toUpperCase() === 'FEMALE' || swimmer.gender?.toUpperCase() === 'F' ? 'F' : 'M',
      }
    );

    // Navigate to the swimmer's page
    navigate(`/swimmers/${result.swimmer.id}`);
  };

  // Get top performances - unique events only (best time per event)
  const topResults = (() => {
    if (!finaData?.all_results) return [];
    
    const uniqueEvents = new Map<string, ExternalSwimmerBestTime>();
    finaData.all_results.forEach(result => {
      const eventKey = `${result.distance}-${result.stroke}`;
      const existing = uniqueEvents.get(eventKey);
      if (!existing || result.fina_points > existing.fina_points) {
        uniqueEvents.set(eventKey, result);
      }
    });
    
    return Array.from(uniqueEvents.values())
      .sort((a, b) => b.fina_points - a.fina_points)
      .slice(0, 5);
  })();
  
  const strokeData: Record<string, ExternalSwimmerBestTime[]> = finaData?.by_stroke || {};

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-linear-to-r from-cyan-500/10 via-blue-500/10 to-cyan-500/10 border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsIDE2MywgMTg0LCAwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-6 transition-all duration-200 hover:gap-3 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          {/* Swimmer Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-linear-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                    {swimmer.name}
                  </h1>
                  <div className="flex flex-wrap gap-4 mt-2 text-slate-400">
                    {swimmer.birth_year && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <Calendar size={14} />
                        Born {swimmer.birth_year}
                      </span>
                    )}
                    {swimmer.club && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <MapPin size={14} />
                        {swimmer.club}
                      </span>
                    )}
                    {swimmer.nation && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <Globe size={14} />
                        {swimmer.nation}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Add to Squad Button */}
            <button
              onClick={() => setShowAddToSquad(true)}
              className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-200 font-medium"
            >
              <UserPlus size={18} />
              Add to Squad
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Sync Status Banner */}
        {syncStatus && (
          <div className={`mb-6 p-4 rounded-xl border ${
            syncStatus.sync_status === 'completed' 
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : syncStatus.sync_status === 'failed'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
          }`}>
            <div className="flex items-center gap-3">
              {syncStatus.sync_status === 'pending' || syncStatus.sync_status === 'in_progress' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin shrink-0 text-cyan-400" />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {syncStatus.sync_status === 'pending' ? 'Preparing to import data...' : 'Importing swimmer data...'}
                    </p>
                    {syncStatus.sync_progress !== undefined && syncStatus.sync_total !== undefined && syncStatus.sync_total > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-end text-sm mb-1">
                          <span>{Math.round((syncStatus.sync_progress / syncStatus.sync_total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-cyan-500/20 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-cyan-500 h-full transition-all duration-300 ease-out"
                            style={{ width: `${(syncStatus.sync_progress / syncStatus.sync_total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : syncStatus.sync_status === 'completed' ? (
                <>
                  <TrendingUp className="w-5 h-5" />
                  <p className="font-semibold">Data import completed!</p>
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5" />
                  <p className="font-semibold">Data import failed</p>
                  {syncStatus.sync_error && (
                    <p className="text-sm opacity-80 ml-2">{syncStatus.sync_error}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Course Selector */}
        <div className="inline-flex gap-1 p-1 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/60 mb-8 shadow-md">
          <button
            onClick={() => setCourse('LCM')}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
              course === 'LCM'
                ? 'bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            Long Course (50m)
          </button>
          <button
            onClick={() => setCourse('SCM')}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
              course === 'SCM'
                ? 'bg-linear-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            Short Course (25m)
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center backdrop-blur-xl">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && finaData && (
          <>
            {finaData.all_results.length === 0 ? (
              <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-12 text-center">
                <p className="text-slate-400 text-lg">
                  No times found for {course} course
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* FINA Points Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'].map((stroke) => {
                    const maxPoints = Math.max(...(strokeData[stroke]?.map((t: ExternalSwimmerBestTime) => t.fina_points) || [0]));
                    const hasPoints = maxPoints > 0;
                    return (
                      <div
                        key={stroke}
                        className={`group relative overflow-hidden rounded-2xl border p-6 text-center transition-all duration-300 ${
                          hasPoints 
                            ? 'bg-slate-900/90 backdrop-blur-xl border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer' 
                            : 'bg-slate-900/50 border-slate-800/30'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 mb-3 font-bold uppercase tracking-widest">
                          {stroke === 'Individual Medley' ? 'IM' : stroke}
                        </div>
                        <div className={`text-5xl font-black tracking-tight mb-1 transition-transform duration-300 ${
                          hasPoints 
                            ? 'bg-linear-to-br from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-transparent group-hover:scale-110' 
                            : 'text-slate-500/30'
                        }`}>
                          {hasPoints ? maxPoints : '—'}
                        </div>
                        {hasPoints && (
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">FINA Points</div>
                        )}
                        {hasPoints && (
                          <>
                            <div className="absolute inset-0 bg-linear-to-br from-cyan-500/0 via-cyan-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-cyan-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"></div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Top 5 Best Results */}
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-1 w-16 bg-linear-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                    <h2 className="text-2xl font-bold text-slate-100">
                      Top Performances
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {topResults.map((result, idx) => (
                      <div
                        key={idx}
                        className="group relative flex items-center justify-between p-5 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 border border-slate-700/40 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-md hover:shadow-cyan-500/10"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-cyan-500 to-blue-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                              {result.distance}m {result.stroke}
                            </span>
                            <span className="text-lg font-semibold text-cyan-400">
                              {result.time_formatted}
                            </span>
                          </div>
                          <div className="text-sm text-slate-400 mt-1.5 font-medium">
                            {result.meet_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {result.city} • {result.date}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-4xl font-black bg-linear-to-br from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                            {result.fina_points}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">FINA Points</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Best Times by Stroke */}
                {Object.entries(strokeData)
                  .sort((a, b) => {
                    const maxA = Math.max(...(a[1] as ExternalSwimmerBestTime[]).map((t: ExternalSwimmerBestTime) => t.fina_points));
                    const maxB = Math.max(...(b[1] as ExternalSwimmerBestTime[]).map((t: ExternalSwimmerBestTime) => t.fina_points));
                    return maxB - maxA;
                  })
                  .map(([stroke, times]) => {
                    // Group times by event (distance)
                    const timesByEvent = (times as ExternalSwimmerBestTime[]).reduce((acc, time) => {
                      if (!acc[time.distance]) {
                        acc[time.distance] = [];
                      }
                      acc[time.distance].push(time);
                      return acc;
                    }, {} as Record<number, ExternalSwimmerBestTime[]>);

                    // Sort events by distance
                    const sortedEvents = Object.entries(timesByEvent)
                      .sort(([a], [b]) => Number(a) - Number(b));

                    return (
                      <div
                        key={stroke}
                        className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/60 p-6 shadow-lg hover:shadow-xl hover:shadow-cyan-500/5 transition-all"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-1 w-12 bg-linear-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                          <h3 className="text-xl font-bold text-slate-100">
                            {stroke}
                          </h3>
                        </div>
                        <div className="space-y-4">
                          {sortedEvents.map(([distance, eventTimes]) => (
                            <div key={distance}>
                              <div className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                {distance}m
                              </div>
                              <div className="space-y-2">
                                {eventTimes
                                  .sort((a, b) => b.fina_points - a.fina_points)
                                  .map((time: ExternalSwimmerBestTime, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl hover:bg-slate-800/50 border border-slate-700/40 hover:border-cyan-500/30 transition-all"
                                    >
                                      <div className="flex-1">
                                        <div className="font-semibold text-slate-100">
                                          {time.time_formatted}
                                        </div>
                                        <div className="text-sm text-slate-400 mt-1">
                                          {time.meet_name} • {time.date}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-2xl font-black bg-linear-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                                          {time.fina_points}
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">FINA</div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add to Squad Modal */}
      {swimmer && (
        <AddToSquadModal
          isOpen={showAddToSquad}
          swimmer={{
            athlete_id: swimmer.athlete_id,
            name: swimmer.name,
            gender: swimmer.gender || '',
            birth_year: swimmer.birth_year ? parseInt(swimmer.birth_year) : undefined,
            nation: swimmer.nation,
            club: swimmer.club,
          }}
          onClose={() => setShowAddToSquad(false)}
          onSubmit={handleAddToSquad}
        />
      )}
    </div>
  );
}
