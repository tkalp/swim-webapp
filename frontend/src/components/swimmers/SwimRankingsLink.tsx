import { useState, useEffect } from 'react';
import { Link2, Trash2, Search, CheckCircle, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  searchSwimRankings,
  linkSwimmer,
  getSwimmerLinks,
  deleteLink,
  type SwimRankingsSearchResult,
  type SwimmerExternalLink,
} from '../../services/swimRankingsService';

interface SwimRankingsLinkProps {
  swimmerId: string;
  firstName?: string;
  lastName?: string;
}

export default function SwimRankingsLink({
  swimmerId,
  firstName,
  lastName,
}: SwimRankingsLinkProps) {
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [searchFirstName, setSearchFirstName] = useState(firstName || '');
  const [searchLastName, setSearchLastName] = useState(lastName || '');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SwimRankingsSearchResult[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [links, setLinks] = useState<SwimmerExternalLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, [swimmerId]);

  async function loadLinks() {
    try {
      setLoadingLinks(true);
      const data = await getSwimmerLinks(swimmerId);
      setLinks(data);
    } catch (err) {
      console.error('Failed to load links:', err);
    } finally {
      setLoadingLinks(false);
    }
  }

  async function handleSearch() {
    if (!searchFirstName.trim() || !searchLastName.trim()) {
      setError('Please enter both first and last name');
      return;
    }

    setSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const results = await searchSwimRankings(searchFirstName.trim(), searchLastName.trim());
      setSearchResults(results);
      
      if (results.length === 0) {
        setError('No swimmers found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search for swimmer');
    } finally {
      setSearching(false);
    }
  }

  async function handleLink(result: SwimRankingsSearchResult) {
    setLinkingId(result.athlete_id);
    setError(null);

    try {
      await linkSwimmer({
        swimmer_id: swimmerId,
        swimrankings_athlete_id: result.athlete_id,
        swimrankings_name: result.name,
        birth_year: result.birth_year ? parseInt(result.birth_year) : undefined,
        nation_code: result.nation || undefined,
        club_name: result.club || undefined,
        gender: result.gender || undefined,
        verified: true,
      });

      showToast('Successfully linked swimmer for tracking!', 'success');
      setShowModal(false);
      setSearchResults([]);
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link swimmer');
    } finally {
      setLinkingId(null);
    }
  }

  async function handleDelete(linkId: string) {
    if (!confirm('Are you sure you want to remove this link?')) {
      return;
    }

    try {
      await deleteLink(linkId);
      showToast('Link removed successfully', 'success');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove link');
    }
  }

  const hasSwimRankingsLink = links.some(link => link.platform === 'swimrankings');

  return (
    <>
      {/* Existing Links Display */}
      {loadingLinks ? (
        <div className="p-4 bg-gradient-to-r from-background-elevated to-background-secondary/50 rounded-xl border border-border/40 animate-pulse">
          <div className="h-4 bg-background-tertiary/50 rounded w-1/3"></div>
        </div>
      ) : links.length > 0 ? (
        <div className="space-y-2">
          {links.map(link => (
            <div
              key={link.id}
              className="group relative flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 hover:from-primary/10 hover:via-accent/10 hover:to-primary/10 rounded-xl border border-primary/20 hover:border-primary/40 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-accent/5 to-primary/0 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-3">
                <div className="p-2 bg-primary/10 group-hover:bg-primary/20 rounded-lg transition-colors duration-300">
                  <Link2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                      Tracked Swimmer
                    </span>
                    {link.verified && (
                      <CheckCircle className="w-3.5 h-3.5 text-success" />
                    )}
                  </div>
                  <span className="text-xs text-text-secondary">
                    {link.external_name}
                    {link.club_name && ` • ${link.club_name}`}
                    {link.birth_year && ` • ${link.birth_year}`}
                  </span>
                </div>
              </div>
              <div className="relative flex items-center gap-1">
                <button
                  onClick={() => handleDelete(link.id)}
                  className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-all duration-200"
                  title="Remove link"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Track Swimmer Button */}
      {!hasSwimRankingsLink && (
        <button
          onClick={() => setShowModal(true)}
          className="group relative w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-right-bottom border border-primary/40 hover:border-primary/60 rounded-xl text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 transition-all duration-500 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
          <Link2 className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
          <span className="relative">Track Swimmer</span>
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-gradient-to-br from-background-elevated to-background-secondary/50 rounded-2xl border border-border/60 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">
                  Track Swimmer
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSearchResults([]);
                  setError(null);
                }}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-background-secondary/50 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              {/* Search Form */}
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  Search for this swimmer to enable automatic result tracking.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      placeholder="First Name"
                      value={searchFirstName}
                      onChange={(e) => setSearchFirstName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full px-4 py-2.5 bg-background-secondary/80 border border-border/60 rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:bg-background-secondary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={searchLastName}
                      onChange={(e) => setSearchLastName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full px-4 py-2.5 bg-background-secondary/80 border border-border/60 rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:bg-background-secondary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Search className={`w-4 h-4 ${searching ? 'animate-pulse' : ''}`} />
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger font-medium">
                  {error}
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Search Results ({searchResults.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {searchResults.map((result) => (
                      <div
                        key={result.athlete_id}
                        className="group p-4 bg-background-secondary/30 hover:bg-background-secondary/60 border border-border/40 hover:border-primary/30 rounded-lg transition-all duration-200 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-text-primary mb-1.5 group-hover:text-primary transition-colors">
                              {result.name}
                            </div>
                            <div className="text-xs text-text-secondary space-y-1">
                              {result.birth_year && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-text-tertiary"></span>
                                  <span>Born: {result.birth_year}</span>
                                </div>
                              )}
                              {result.club && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-text-tertiary"></span>
                                  <span className="truncate" title={result.club}>{result.club}</span>
                                </div>
                              )}
                              {result.nation && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-text-tertiary"></span>
                                  <span>{result.nation}</span>
                                </div>
                              )}
                              {result.last_result && (
                                <div className="flex items-center gap-1.5 text-text-tertiary">
                                  <span className="w-1 h-1 rounded-full bg-text-tertiary"></span>
                                  <span className="truncate" title={result.last_result}>{result.last_result}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleLink(result)}
                            disabled={linkingId === result.athlete_id}
                            className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-primary/50 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap"
                          >
                            {linkingId === result.athlete_id ? 'Linking...' : 'Link'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
