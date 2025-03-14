import { NextResponse } from 'next/server';
import axios from 'axios';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifySearchResponse {
  tracks?: {
    items: Array<{
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      album: {
        name: string;
        images: Array<{ url: string }>;
        release_date: string;
      };
      popularity: number;
      preview_url: string | null;
      duration_ms: number;
    }>;
  };
  artists?: {
    items: Array<{
      id: string;
      name: string;
      genres: string[];
      followers: { total: number };
      images: Array<{ url: string }>;
    }>;
  };
  albums?: {
    items: Array<{
      id: string;
      name: string;
      artists: Array<{ name: string }>;
      release_date: string;
      images: Array<{ url: string }>;
      total_tracks: number;
    }>;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'track,artist,album';

  if (!query) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
  }

  try {
    const tokenResponse = await axios.post<SpotifyTokenResponse>('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const searchResponse = await axios.get<SpotifySearchResponse>(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    return NextResponse.json(searchResponse.data);
  } catch (error: any) {
    console.error('Search error:', error.response?.data || error.message);
    return NextResponse.json(
      { error: error.response?.data?.error?.message || 'Failed to search Spotify' },
      { status: error.response?.status || 500 }
    );
  }
} 