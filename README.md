# Top Tracks

A web application that allows you to search Spotify tracks, artists, and albums, and view their popularity rankings. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- Search for tracks, artists, and albums on Spotify
- View track rankings within albums
- See artist's top tracks
- Dark mode support
- Responsive design
- Real-time search with debouncing
- Spotify URL support

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/top-tracks.git
cd top-tracks
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with your Spotify API credentials:
```bash
cp .env.example .env.local
```
Then edit `.env.local` with your actual Spotify API credentials.

4. Run the development server:
```bash
npm run dev
```

## Deployment on Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Add environment variables:
```bash
vercel env add SPOTIFY_CLIENT_ID
vercel env add SPOTIFY_CLIENT_SECRET
```

## Technologies Used

- Next.js 14
- TypeScript
- Tailwind CSS
- Spotify Web API

## License

MIT
