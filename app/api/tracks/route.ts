import { NextResponse } from 'next/server';
import axios from 'axios';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  preview_url: string | null;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
}

interface SpotifyAlbumTracksResponse {
  items: Array<{
    id: string;
    name: string;
  }>;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    // Extract album ID from URL
    const albumId = url.split('/album/')[1]?.split('?')[0];
    if (!albumId) {
      return NextResponse.json({ error: 'Invalid album URL' }, { status: 400 });
    }

    // Get all tracks from the album
    const response = await axios.get<SpotifyAlbumTracksResponse>(`${SPOTIFY_API_BASE}/albums/${albumId}/tracks`, {
      headers: {
        Authorization: `Bearer ${process.env.SPOTIFY_ACCESS_TOKEN}`,
      },
    });

    // Get track details including popularity
    const tracks = await Promise.all(
      response.data.items.map(async (track) => {
        const trackResponse = await axios.get<SpotifyTrack>(`${SPOTIFY_API_BASE}/tracks/${track.id}`, {
          headers: {
            Authorization: `Bearer ${process.env.SPOTIFY_ACCESS_TOKEN}`,
          },
        });
        return trackResponse.data;
      })
    );

    // Sort tracks by popularity in descending order
    const sortedTracks = tracks.sort((a, b) => b.popularity - a.popularity);

    return NextResponse.json(sortedTracks);
  } catch (error: any) {
    console.error('Error fetching tracks:', error.response?.data || error.message);
    return NextResponse.json(
      { error: error.response?.data?.error || 'Failed to fetch tracks' },
      { status: error.response?.status || 500 }
    );
  }
}

function extractAlbumId(url: string): string | null {
  const match = url.match(/album\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
} 