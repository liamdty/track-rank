import { NextResponse } from 'next/server';
import axios from 'axios';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyArtist {
  name: string;
  id: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  popularity: number;
  duration_ms: number;
  preview_url: string | null;
  album?: {
    id: string;
    name: string;
    release_date: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  explicit?: boolean;
}

interface SpotifyAlbumResponse {
  items: Array<{
    id: string;
    name: string;
    artists: SpotifyArtist[];
  }>;
  next: string | null;
}

interface ProcessedTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  popularity: number;
  duration_ms: number;
  preview_url: string | null;
  album?: {
    id: string;
    name: string;
    release_date: string;
    total_tracks: number;
    images: Array<{ url: string; height: number; width: number }>;
  };
  explicit?: boolean;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  total_tracks: number;
  artists: SpotifyArtist[];
}

interface SpotifyArtistResponse {
  id: string;
  name: string;
  genres: string[];
  followers: { total: number };
  images: Array<{ url: string; height: number; width: number }>;
}

interface SpotifyAlbumsResponse {
  items: SpotifyAlbum[];
  next: string | null;
}

interface SpotifyAlbumDetails {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  release_date: string;
  total_tracks: number;
  images: Array<{ url: string; height: number; width: number }>;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    next: string | null;
  };
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  const response = await axios.post<SpotifyTokenResponse>(TOKEN_ENDPOINT, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
  });

  return response.data.access_token;
}

async function getTrackDetails(trackId: string, accessToken: string): Promise<ProcessedTrack> {
  const response = await axios.get<SpotifyTrack>(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // Get full album details to get images
  const albumResponse = response.data.album ? await axios.get<SpotifyAlbumDetails>(`${SPOTIFY_API_BASE}/albums/${response.data.album.id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }) : null;

  return {
    id: response.data.id,
    name: response.data.name,
    artists: response.data.artists.map((artist) => ({
      name: artist.name,
      id: artist.id
    })),
    popularity: response.data.popularity,
    duration_ms: response.data.duration_ms,
    preview_url: response.data.preview_url,
    album: response.data.album ? {
      id: response.data.album.id,
      name: response.data.album.name,
      release_date: response.data.album.release_date,
      total_tracks: albumResponse?.data.total_tracks || 1,
      images: albumResponse?.data.images || response.data.album.images || []
    } : undefined,
    explicit: response.data.explicit,
  };
}

async function getAlbumTracks(albumId: string, accessToken: string): Promise<ProcessedTrack[]> {
  const albumResponse = await axios.get<SpotifyAlbumDetails>(`${SPOTIFY_API_BASE}/albums/${albumId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const response = await axios.get<SpotifyAlbumResponse>(`${SPOTIFY_API_BASE}/albums/${albumId}/tracks?limit=50`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // If there are more tracks, fetch them
  let allTracks = response.data.items;
  let offset = 50;
  
  while (response.data.next) {
    const nextResponse = await axios.get<SpotifyAlbumResponse>(`${SPOTIFY_API_BASE}/albums/${albumId}/tracks?limit=50&offset=${offset}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    allTracks = [...allTracks, ...nextResponse.data.items];
    offset += 50;
  }

  const tracks = await Promise.all(
    allTracks.map(async (track) => {
      const trackDetails = await getTrackDetails(track.id, accessToken);
      return {
        ...trackDetails,
        album: trackDetails.album ? {
          ...trackDetails.album,
          images: albumResponse.data.images
        } : undefined
      };
    })
  );

  return tracks.sort((a, b) => b.popularity - a.popularity);
}

async function getArtistDetails(artistId: string, accessToken: string): Promise<SpotifyArtistResponse> {
  const response = await axios.get<SpotifyArtistResponse>(
    `${SPOTIFY_API_BASE}/artists/${artistId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return response.data;
}

async function getArtistTopTracks(artistId: string, accessToken: string): Promise<ProcessedTrack[]> {
  const artistResponse = await axios.get<SpotifyArtistResponse>(
    `${SPOTIFY_API_BASE}/artists/${artistId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  let primaryArtistTracks: SpotifyTrack[] = [];
  let offset = 0;
  let firstBatch = true;
  
  // Keep fetching until we have at least 100 tracks where the artist is primary
  while (primaryArtistTracks.length < 100 && offset < 200) {
    const limit = 50;  // Always fetch maximum allowed per request
    const searchResponse = await axios.get<SpotifySearchResponse>(
      `${SPOTIFY_API_BASE}/search?type=track&limit=${limit}&offset=${offset}&q=artist:"${encodeURIComponent(artistResponse.data.name)}"`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const newTracks = searchResponse.data.tracks.items;
    if (newTracks.length === 0) break; // No more results

    // Filter for primary artist tracks
    const newPrimaryTracks = newTracks.filter(track => track.artists[0].id === artistId);
    primaryArtistTracks = [...primaryArtistTracks, ...newPrimaryTracks];
    
    offset += limit;
    firstBatch = false;
  }

  // Process and return the top 100 tracks
  return primaryArtistTracks
    .map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists,
      popularity: track.popularity,
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
      album: track.album && {
        id: track.album.id,
        name: track.album.name,
        release_date: track.album.release_date,
        total_tracks: 1, // For search results, we don't have this info
        images: track.album.images
      },
      explicit: track.explicit,
    }))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 100);
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken();

    // Detect URL type
    const artistMatch = url.match(/artist\/([a-zA-Z0-9]+)/);
    const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);

    let result;
    if (artistMatch) {
      const artistId = artistMatch[1];
      const [artist, topTracks] = await Promise.all([
        getArtistDetails(artistId, accessToken),
        getArtistTopTracks(artistId, accessToken)
      ]);
      result = { artist, topTracks };
    } else if (albumMatch) {
      const albumId = albumMatch[1];
      const albumResponse = await axios.get<SpotifyAlbumDetails>(`${SPOTIFY_API_BASE}/albums/${albumId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      const albumTracks = await getAlbumTracks(albumId, accessToken);
      result = { 
        album: {
          id: albumResponse.data.id,
          name: albumResponse.data.name,
          artists: albumResponse.data.artists,
          release_date: albumResponse.data.release_date,
          total_tracks: albumResponse.data.total_tracks,
          images: albumResponse.data.images
        },
        albumTracks 
      };
    } else if (trackMatch) {
      const trackId = trackMatch[1];
      const track = await getTrackDetails(trackId, accessToken);
      
      if (!track.album) {
        return NextResponse.json(
          { error: 'Track album information not found' },
          { status: 404 }
        );
      }

      const albumId = track.album.id;
      const artistId = track.artists[0].id;

      if (!artistId) {
        return NextResponse.json(
          { error: 'Artist information not found' },
          { status: 404 }
        );
      }

      const [albumTracks, artistTopTracks] = await Promise.all([
        getAlbumTracks(albumId, accessToken),
        getArtistTopTracks(artistId, accessToken)
      ]);

      const trackRank = albumTracks.findIndex((t) => t.id === trackId) + 1;
      const artistTrackRank = artistTopTracks.findIndex((t) => t.id === trackId) + 1;

      result = {
        track,
        albumTracks,
        trackRank,
        totalTracks: albumTracks.length,
        artistTopTracks: track.album.total_tracks === 1 ? artistTopTracks : undefined,
        artistTrackRank: track.album.total_tracks === 1 ? artistTrackRank : undefined
      };
    } else {
      return NextResponse.json(
        { error: 'Invalid Spotify URL. Please provide a valid artist, album, or track URL.' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching data:', error);
    return NextResponse.json(
      { error: error.response?.data?.error?.message || 'Failed to fetch data' },
      { status: error.response?.status || 500 }
    );
  }
} 