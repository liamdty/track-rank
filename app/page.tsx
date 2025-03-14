'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import debounce from 'lodash/debounce';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  popularity: number;
  duration_ms: number;
  preview_url: string | null;
  album?: {
    id: string;
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
  explicit?: boolean;
}

interface Artist {
  id: string;
  name: string;
  genres: string[];
  followers: { total: number };
  images: Array<{ url: string }>;
}

interface Album {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  release_date: string;
  images: Array<{ url: string }>;
  total_tracks: number;
}

interface ApiResponse {
  track?: Track;
  albumTracks?: Track[];
  trackRank?: number;
  totalTracks?: number;
  topTracks?: Track[];
}

interface SearchResponse {
  tracks?: { items: Track[] };
  artists?: { items: Artist[] };
  albums?: { items: Album[] };
}

type SearchType = 'track' | 'artist' | 'album';

interface SearchResult {
  type: 'track' | 'artist' | 'album';
  data: Track | Artist | Album;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'track' | 'artist' | 'album'>('all');
  const searchRef = useRef<HTMLDivElement>(null);

  const isSpotifyUrl = (query: string) => {
    return query.includes('spotify.com') || query.includes('spotify.link');
  };

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      if (isSpotifyUrl(query)) {
        setLoading(true);
        try {
          const response = await axios.post<ApiResponse>('/api/spotify', { url: query });
          setData(response.data);
          setSearchResults(null);
        } catch (err: any) {
          setError(err.response?.data?.error || 'Failed to fetch data. Please try again.');
        } finally {
          setLoading(false);
        }
        return;
      }

      setIsSearching(true);
      try {
        const response = await axios.get<SearchResponse>(`/api/spotify/search?q=${encodeURIComponent(query)}&type=track,artist,album`);
        setSearchResults(response.data);
        setData(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to search. Please try again.');
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = async (type: 'track' | 'artist' | 'album', id: string) => {
    setLoading(true);
    try {
      const response = await axios.post<ApiResponse>('/api/spotify', { 
        url: `https://open.spotify.com/${type}/${id}` 
      });
      setData(response.data);
      setSearchResults(null);
      setShowDropdown(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const renderTrackCard = (track: Track, showAlbum = true) => (
    <div
      key={track.id}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {track.name}
            {track.explicit && (
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                E
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {track.artists.map(artist => artist.name).join(', ')}
          </p>
          {showAlbum && track.album && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {track.album.name} • {formatDate(track.album.release_date)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatDuration(track.duration_ms)}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div
                className="h-full bg-[#1DB954] rounded-full"
                style={{ width: `${track.popularity}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Popularity: {track.popularity}</span>
          </div>
        </div>
      </div>
      {track.preview_url && (
        <audio
          controls
          className="mt-4 w-full accent-[#1DB954]"
          src={track.preview_url}
        >
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );

  const renderSearchResults = () => {
    if (!searchResults) return null;

    const filteredResults = {
      tracks: selectedFilter === 'all' || selectedFilter === 'track' ? searchResults.tracks?.items : [],
      artists: selectedFilter === 'all' || selectedFilter === 'artist' ? searchResults.artists?.items : [],
      albums: selectedFilter === 'all' || selectedFilter === 'album' ? searchResults.albums?.items : []
    };

    const hasResults = filteredResults.tracks?.length || filteredResults.artists?.length || filteredResults.albums?.length;
    if (!hasResults) return null;

    // Combine and interleave results
    const maxResults = Math.max(
      filteredResults.tracks?.length || 0,
      filteredResults.artists?.length || 0,
      filteredResults.albums?.length || 0
    );
    
    const allResults: SearchResult[] = [];
    for (let i = 0; i < maxResults; i++) {
      if (filteredResults.tracks?.[i]) {
        allResults.push({ type: 'track' as const, data: filteredResults.tracks[i] });
      }
      if (filteredResults.artists?.[i]) {
        allResults.push({ type: 'artist' as const, data: filteredResults.artists[i] });
      }
      if (filteredResults.albums?.[i]) {
        allResults.push({ type: 'album' as const, data: filteredResults.albums[i] });
      }
    }

    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
        {allResults.map((result) => (
          <button
            key={`${result.type}-${result.data.id}`}
            onClick={() => handleResultClick(result.type, result.data.id)}
            className="w-full text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              {result.type === 'track' && 'album' in result.data && result.data.album?.images[0] && (
                <img
                  src={result.data.album.images[0].url}
                  alt={result.data.album.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              {result.type === 'artist' && 'images' in result.data && result.data.images[0] && (
                <img
                  src={result.data.images[0].url}
                  alt={result.data.name}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                />
              )}
              {result.type === 'album' && 'images' in result.data && result.data.images[0] && (
                <img
                  src={result.data.images[0].url}
                  alt={result.data.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                    {result.data.name}
                    {result.type === 'track' && 'explicit' in result.data && result.data.explicit && (
                      <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                        E
                      </span>
                    )}
                  </h3>
                  <a
                    href={`https://open.spotify.com/${result.type}/${result.data.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-5 h-5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </a>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {result.type === 'track' && 'artists' in result.data && result.data.artists.map(artist => artist.name).join(', ')}
                  {result.type === 'artist' && 'followers' in result.data && `${formatNumber(result.data.followers.total)} followers`}
                  {result.type === 'album' && 'artists' in result.data && result.data.artists.map(artist => artist.name).join(', ')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {result.type === 'track' && 'album' in result.data && `${result.data.album?.name} • ${formatDate(result.data.album?.release_date || '')}`}
                  {result.type === 'artist' && 'genres' in result.data && result.data.genres.slice(0, 2).join(', ')}
                  {result.type === 'album' && 'release_date' in result.data && `${formatDate(result.data.release_date)} • ${result.data.total_tracks} tracks`}
                </p>
                {result.type === 'track' && 'popularity' in result.data && (
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0">
                      <div
                        className="h-full bg-[#1DB954] rounded-full"
                        style={{ width: `${result.data.popularity}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">Popularity: {result.data.popularity}</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-5xl font-bold text-center mb-12 text-gray-900 dark:text-white font-display">
          Top Tracks
        </h1>
        
        <div className="relative mb-12" ref={searchRef}>
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Paste Spotify URL or search Spotify..."
              className="w-full px-6 py-3 text-lg border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-transparent transition-all duration-200 font-sans"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-6 h-6 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {showDropdown && searchResults && !isSpotifyUrl(searchQuery) && (
            <div className="absolute left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl mt-2">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <select
                      value={selectedFilter}
                      onChange={(e) => setSelectedFilter(e.target.value as 'all' | 'track' | 'artist' | 'album')}
                      className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-transparent font-sans"
                    >
                      <option value="all">All Results</option>
                      <option value="track">Tracks</option>
                      <option value="artist">Artists</option>
                      <option value="album">Albums</option>
                    </select>
                  </div>
                  {renderSearchResults()}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-8">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-12">
            {data.track && data.albumTracks && (
              <>
                <div className="bg-[#1DB954]/10 dark:bg-[#1DB954]/20 p-6 rounded-xl">
                  <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">
                    Track Rank in Album
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300">
                    "{data.track.name}" is ranked #{data.trackRank} out of {data.totalTracks} tracks in the album "{data.track.album?.name}"
                  </p>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">All Album Tracks</h2>
                  <div className="space-y-4">
                    {data.albumTracks.map((track) => (
                      <div key={track.id} className="relative">
                        {track.id === data.track?.id && (
                          <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[#1DB954]">
                            →
                          </div>
                        )}
                        {renderTrackCard(track)}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {data.albumTracks && !data.track && data.albumTracks[0]?.album && (
              <div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <img
                      src={data.albumTracks[0].album.images[0].url}
                      alt={data.albumTracks[0].album.name}
                      className="w-48 h-48 rounded-lg object-cover shadow-md"
                    />
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                        {data.albumTracks[0].album.name}
                      </h2>
                      <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">
                        {data.albumTracks[0].artists.map(artist => artist.name).join(', ')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Released {formatDate(data.albumTracks[0].album.release_date)} • {data.albumTracks.length} tracks
                      </p>
                      <a
                        href={`https://open.spotify.com/album/${data.albumTracks[0].album.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-4 text-[#1DB954] hover:text-[#1ed760] transition-colors duration-200"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                        Open in Spotify
                      </a>
                    </div>
                  </div>
                </div>
                <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Album Tracks</h2>
                <div className="space-y-4">
                  {data.albumTracks.map((track, index) => (
                    <div key={track.id} className="relative">
                      <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                        #{index + 1}
                      </div>
                      {renderTrackCard(track)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.topTracks && (
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Artist's Top Tracks</h2>
                <div className="space-y-4">
                  {data.topTracks.map((track, index) => (
                    <div key={track.id} className="relative">
                      <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                        #{index + 1}
                      </div>
                      {renderTrackCard(track)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
