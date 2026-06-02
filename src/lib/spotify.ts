// ============================================================
// Spotify Web API wrapper
// Uses ONLY endpoints confirmed available as of 2026-06:
//   - GET /me/top/artists   (user-top-read)
//   - GET /me/top/tracks    (user-top-read)
//   - GET /me               (basic profile; note country/email/product removed 2026-02)
// Does NOT use removed endpoints (artist top-tracks, several-artists, new-releases, etc.)
// ============================================================

const SPOTIFY_API = "https://api.spotify.com/v1";

export type SpotifyArtist = {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images?: { url: string; width: number; height: number }[];
};

export type SpotifyTrack = {
  id: string;
  name: string;
  popularity: number;
  artists: { id: string; name: string }[];
  album?: { id: string; name: string; images?: { url: string }[] };
};

type TimeRange = "short_term" | "medium_term" | "long_term";

async function spotifyGet<T>(endpoint: string, accessToken: string): Promise<T> {
  const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify API ${res.status} on ${endpoint}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Top artists for a time range (max 50)
export async function getTopArtists(
  accessToken: string,
  timeRange: TimeRange = "medium_term",
  limit = 50
): Promise<SpotifyArtist[]> {
  const data = await spotifyGet<{ items: SpotifyArtist[] }>(
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
  return data.items ?? [];
}

// Top tracks for a time range (max 50)
export async function getTopTracks(
  accessToken: string,
  timeRange: TimeRange = "medium_term",
  limit = 50
): Promise<SpotifyTrack[]> {
  const data = await spotifyGet<{ items: SpotifyTrack[] }>(
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
  return data.items ?? [];
}

// Aggregate top artists across all time ranges, deduped, with a weight by recency.
export async function getAggregatedTopArtists(
  accessToken: string
): Promise<SpotifyArtist[]> {
  const [shortT, mediumT, longT] = await Promise.all([
    getTopArtists(accessToken, "short_term", 50).catch(() => []),
    getTopArtists(accessToken, "medium_term", 50).catch(() => []),
    getTopArtists(accessToken, "long_term", 50).catch(() => []),
  ]);
  // dedupe by id, keep first occurrence (short_term first = most current)
  const seen = new Map<string, SpotifyArtist>();
  for (const list of [shortT, mediumT, longT]) {
    for (const a of list) {
      if (!seen.has(a.id)) seen.set(a.id, a);
    }
  }
  return Array.from(seen.values());
}

// Basic profile (display name, images). country/email/product no longer returned (2026-02).
export async function getProfile(accessToken: string) {
  return spotifyGet<{
    id: string;
    display_name: string | null;
    images?: { url: string }[];
  }>("/me", accessToken);
}
