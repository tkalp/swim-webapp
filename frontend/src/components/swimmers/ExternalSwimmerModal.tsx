import { useState } from 'react';
import { X, Search, User, Calendar, MapPin, Award, Globe } from 'lucide-react';
import {
  searchSwimRankings,
  getExternalSwimmerFinaPoints,
  type SwimRankingsSearchResult,
  type ExternalSwimmerFinaPoints,
} from '@/services/swimRankingsService';

interface ExternalSwimmerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExternalSwimmerModal({ isOpen, onClose }: ExternalSwimmerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SwimRankingsSearchResult[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<SwimRankingsSearchResult | null>(null);
  const [finaData, setFinaData] = useState<ExternalSwimmerFinaPoints | null>(null);
  const [course, setCourse] = useState<'LCM' | 'SCM'>('LCM');
  const [isLoadingFina, setIsLoadingFina] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setSelectedAthlete(null);
    setFinaData(null);

    try {
      // Split search query into first and last name
      const parts = searchQuery.trim().split(/\s+/);
      const firstname = parts[0] || '';
      const lastname = parts.slice(1).join(' ') || parts[0]; // Use first name for both if only one word

      const results = await searchSwimRankings(firstname, lastname);
      setSearchResults(results);

      if (results.length === 0) {
        setError('No swimmers found. Try a different name.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAthlete = async (athlete: SwimRankingsSearchResult) => {
    setSelectedAthlete(athlete);
    setIsLoadingFina(true);
    setError(null);

    try {
      // Determine gender - normalize to M/F
      const gender = athlete.gender?.toUpperCase().startsWith('M') ? 'M' : 'F';
      
      const data = await getExternalSwimmerFinaPoints(athlete.athlete_id, gender, course);
      setFinaData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load swimmer data');
      setFinaData(null);
    } finally {
      setIsLoadingFina(false);
    }
  };

  const handleCourseChange = async (newCourse: 'LCM' | 'SCM') => {
    if (!selectedAthlete) return;
    
    setCourse(newCourse);
    setIsLoadingFina(true);
    setError(null);

    try {
      const gender = selectedAthlete.gender?.toUpperCase().startsWith('M') ? 'M' : 'F';
      const data = await getExternalSwimmerFinaPoints(selectedAthlete.athlete_id, gender, newCourse);
      setFinaData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load swimmer data');
      setFinaData(null);
    } finally {
      setIsLoadingFina(false);
    }
  };

  const handleBack = () => {
    setSelectedAthlete(null);
    setFinaData(null);
    setError(null);
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedAthlete(null);
    setFinaData(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-300 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Search Any Swimmer
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {!selectedAthlete ? (
              <>
                {/* Search Form */}
                <div className="mb-6">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter swimmer name (e.g., Teddy Kalp)"
                        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                      className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Search for any swimmer on SwimRankings.net to view their FINA points
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">
                    {error}
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Search Results</h3>
                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.athlete_id}
                          onClick={() => handleSelectAthlete(result)}
                          className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-gray-900">
                                  {result.name}
                                </span>
                                {result.birth_year && (
                                  <span className="text-sm text-gray-500">
                                    ({result.birth_year})
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
                                {result.club && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {result.club}
                                  </span>
                                )}
                                {result.nation && (
                                  <span className="flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    {result.nation}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Athlete Profile */}
                <div className="space-y-6">
                  {/* Back Button */}
                  <button
                    onClick={handleBack}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    ← Back to search
                  </button>

                  {/* Athlete Header */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {selectedAthlete.name}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                          {selectedAthlete.birth_year && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Born {selectedAthlete.birth_year}
                            </span>
                          )}
                          {selectedAthlete.club && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {selectedAthlete.club}
                            </span>
                          )}
                          {selectedAthlete.nation && (
                            <span className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              {selectedAthlete.nation}
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href={selectedAthlete.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Profile →
                      </a>
                    </div>
                  </div>

                  {/* Course Selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCourseChange('LCM')}
                      className={`rounded-lg px-4 py-2 font-medium ${
                        course === 'LCM'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Long Course (50m)
                    </button>
                    <button
                      onClick={() => handleCourseChange('SCM')}
                      className={`rounded-lg px-4 py-2 font-medium ${
                        course === 'SCM'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Short Course (25m)
                    </button>
                  </div>

                  {/* Loading State */}
                  {isLoadingFina && (
                    <div className="py-12 text-center text-gray-500">
                      Loading swimmer data...
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
                      {error}
                    </div>
                  )}

                  {/* FINA Data */}
                  {finaData && !isLoadingFina && (
                    <>
                      {finaData.all_results.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                          No times found for {course} course
                        </div>
                      ) : (
                        <>
                          {/* FINA Points Summary */}
                          <div className="grid grid-cols-5 gap-2">
                            {['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'].map((stroke) => {
                              const maxPoints = Math.max(...(finaData.by_stroke[stroke]?.map(t => t.fina_points) || [0]));
                              return (
                                <div
                                  key={stroke}
                                  className="rounded-lg border border-gray-200 p-3 text-center"
                                >
                                  <div className="text-xs text-gray-600 mb-1">
                                    {stroke === 'Individual Medley' ? 'IM' : stroke}
                                  </div>
                                  <div className={`text-xl font-bold ${maxPoints > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {maxPoints > 0 ? maxPoints : '-'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Best Times by Stroke */}
                          <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900">
                              Best Times ({course})
                            </h3>
                            {Object.entries(finaData.by_stroke)
                              .sort((a, b) => {
                                const maxA = Math.max(...a[1].map(t => t.fina_points));
                                const maxB = Math.max(...b[1].map(t => t.fina_points));
                                return maxB - maxA;
                              })
                              .map(([stroke, times]) => (
                                <div
                                  key={stroke}
                                  className="rounded-lg border border-gray-200 p-4"
                                >
                                  <h4 className="mb-3 font-medium text-gray-900">
                                    {stroke}
                                  </h4>
                                  <div className="space-y-2">
                                    {times.slice(0, 3).map((time, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                                      >
                                        <div>
                                          <div className="font-medium text-gray-900">
                                            {time.distance}m - {time.time_formatted}
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {time.meet_name} • {time.date}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-lg font-semibold text-blue-600">
                                          <Award className="h-5 w-5" />
                                          {time.fina_points}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
