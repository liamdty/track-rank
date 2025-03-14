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
  };
  explicit?: boolean;
}

interface SpotifyAlbumResponse {
  items: Array<{
    id: string;
    name: string;
    artists: SpotifyArtist[];
  }>;
}

interface ProcessedTrack {
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
  };
  explicit?: boolean;
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

  return {
    id: response.data.id,
    name: response.data.name,
    artists: response.data.artists.map((artist) => ({
      name: artist.name,
    })),
    popularity: response.data.popularity,
    duration_ms: response.data.duration_ms,
    preview_url: response.data.preview_url,
    album: response.data.album,
    explicit: response.data.explicit,
  };
}

async function getAlbumTracks(albumId: string, accessToken: string): Promise<ProcessedTrack[]> {
  const response = await axios.get<SpotifyAlbumResponse>(`${SPOTIFY_API_BASE}/albums/${albumId}/tracks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const tracks = await Promise.all(
    response.data.items.map(async (track) => {
      return getTrackDetails(track.id, accessToken);
    })
  );

  return tracks.sort((a, b) => b.popularity - a.popularity);
}

async function getArtistTopTracks(artistId: string, accessToken: string): Promise<ProcessedTrack[]> {
  const response = await axios.get<{ tracks: SpotifyTrack[] }>(
    `${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks?market=US`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data.tracks.map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((artist) => ({
      name: artist.name,
    })),
    popularity: track.popularity,
    duration_ms: track.duration_ms,
    preview_url: track.preview_url,
    album: track.album,
    explicit: track.explicit,
  }));
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
      const topTracks = await getArtistTopTracks(artistId, accessToken);
      result = { topTracks };
    } else if (albumMatch) {
      const albumId = albumMatch[1];
      const albumTracks = await getAlbumTracks(albumId, accessToken);
      result = { albumTracks };
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
      const albumTracks = await getAlbumTracks(albumId, accessToken);
      const trackRank = albumTracks.findIndex((t) => t.id === trackId) + 1;

      result = {
        track,
        albumTracks,
        trackRank,
        totalTracks: albumTracks.length,
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