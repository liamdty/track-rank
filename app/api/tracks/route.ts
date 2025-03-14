import { NextResponse } from 'next/server';
import axios from 'axios';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    // Extract album ID from URL
    const albumId = extractAlbumId(url);
    if (!albumId) {
      return NextResponse.json(
        { error: 'Invalid Spotify album URL' },
        { status: 400 }
      );
    }

    // Get album tracks
    const response = await axios.get(`${SPOTIFY_API_BASE}/albums/${albumId}/tracks`, {
      headers: {
        Authorization: `Bearer ${process.env.SPOTIFY_ACCESS_TOKEN}`,
      },
    });

    // Get track details including popularity
    const tracks = await Promise.all(
      response.data.items.map(async (track: any) => {
        const trackResponse = await axios.get(`${SPOTIFY_API_BASE}/tracks/${track.id}`, {
          headers: {
            Authorization: `Bearer ${process.env.SPOTIFY_ACCESS_TOKEN}`,
          },
        });
        return trackResponse.data;
      })
    );

    // Sort tracks by popularity
    const sortedTracks = tracks.sort((a: any, b: any) => b.popularity - a.popularity);

    return NextResponse.json({ tracks: sortedTracks });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}

function extractAlbumId(url: string): string | null {
  const match = url.match(/album\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
} 