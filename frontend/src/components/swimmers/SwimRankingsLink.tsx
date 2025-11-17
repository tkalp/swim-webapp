import { useState, useEffect } from 'react';
import { Link2, ExternalLink, Trash2, Search, CheckCircle, X } from 'lucide-react';
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
  const [showSearch, setShowSearch] = useState(false);
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
      setShowSearch(false);
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
    <div className="space-y-3">
      {/* Existing Links */}
      {loadingLinks ? (
        <div className="p-3 bg-background-secondary/30 rounded-lg border border-border/40 animate-pulse">
          <div className="h-4 bg-background-tertiary rounded w-1/3"></div>
        </div>
      ) : links.length > 0 ? (
        <div className="space-y-2">
          {links.map(link => (
            <div
              key={link.id}
              className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/30"
            >
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      Tracked Swimmer
                    </span>
                    {link.verified && (
                      <CheckCircle className="w-3 h-3 text-success" />
                    )}
                  </div>
                  <span className="text-xs text-text-secondary">
                    {link.external_name}
                    {link.club_name && ` • ${link.club_name}`}
                    {link.birth_year && ` • ${link.birth_year}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {link.external_url && (
                  <a
                    href={link.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-text-secondary hover:text-primary transition-colors"
                    title="View profile"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(link.id)}
                  className="p-1.5 text-text-secondary hover:text-danger transition-colors"
                  title="Remove link"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Link Button */}
      {!hasSwimRankingsLink && !showSearch && (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 border border-primary/30 rounded-lg text-sm font-medium text-text-primary transition-all duration-200"
        >
          <Link2 className="w-4 h-4" />
          Track Swimmer
        </button>
      )}

      {/* Search Interface */}
      {showSearch && (
        <div className="p-4 bg-background-elevated rounded-lg border border-border space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Search for Swimmer
            </h3>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchResults([]);
                setError(null);
              }}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="First Name"
              value={searchFirstName}
              onChange={(e) => setSearchFirstName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={searchLastName}
              onChange={(e) => setSearchLastName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={searching}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-primary/50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Search className="w-4 h-4" />
            {searching ? 'Searching...' : 'Search'}
          </button>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.athlete_id}
                  className="p-3 bg-background-secondary/50 hover:bg-background-secondary border border-border rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-text-primary mb-1">
                        {result.name}
                      </div>
                      <div className="text-xs text-text-secondary space-y-0.5">
                        {result.birth_year && (
                          <div>Born: {result.birth_year}</div>
                        )}
                        {result.club && (
                          <div className="truncate" title={result.club}>
                            {result.club}
                          </div>
                        )}
                        {result.nation && (
                          <div>{result.nation}</div>
                        )}
                        {result.last_result && (
                          <div className="text-text-tertiary truncate" title={result.last_result}>
                            {result.last_result}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleLink(result)}
                      disabled={linkingId === result.athlete_id}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-dark disabled:bg-primary/50 rounded text-xs font-medium text-white transition-colors whitespace-nowrap"
                    >
                      {linkingId === result.athlete_id ? 'Linking...' : 'Link'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
