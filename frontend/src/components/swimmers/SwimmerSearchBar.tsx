import { useState, useRef, useEffect } from 'react';
import { Search, User, MapPin, Globe, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  searchSwimRankings,
  type SwimRankingsSearchResult,
} from '@/services/swimRankingsService';

export function SwimmerSearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SwimRankingsSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        handleSearch();
      } else {
        setResults([]);
        setError(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const parts = query.trim().split(/\s+/);
      const firstname = parts[0] || '';
      const lastname = parts.slice(1).join(' ') || parts[0];

      const data = await searchSwimRankings(firstname, lastname);
      setResults(data);

      if (data.length === 0) {
        setError('No swimmers found');
      }
    } catch (err) {
      setError('Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSwimmer = (swimmer: SwimRankingsSearchResult) => {
    // Create URL-safe slug from name
    const slug = swimmer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    navigate(`/swimmer/${slug}`, {
      state: { swimmer }
    });
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search any swimmer..."
          className="w-48 lg:w-64 pl-9 pr-3 py-2 bg-background-secondary/60 border border-border/40 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:bg-background-elevated transition-all duration-200"
        />
        {isSearching && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin"
          />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full mt-2 w-80 bg-background-elevated border border-border/60 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {error && (
            <div className="px-4 py-3 text-sm text-text-muted text-center">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((swimmer) => (
                <button
                  key={swimmer.athlete_id}
                  onClick={() => handleSelectSwimmer(swimmer)}
                  className="w-full px-4 py-3 text-left hover:bg-background-secondary/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-text-secondary shrink-0" />
                        <span className="font-medium text-text-primary truncate">
                          {swimmer.name}
                        </span>
                        {swimmer.birth_year && (
                          <span className="text-sm text-text-muted shrink-0">
                            ({swimmer.birth_year})
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                        {swimmer.club && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {swimmer.club}
                          </span>
                        )}
                        {swimmer.nation && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {swimmer.nation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isSearching && results.length === 0 && query.length >= 2 && !error && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              <p>Type a swimmer's name to search</p>
              <p className="text-xs mt-1">e.g., "Michael Phelps"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
