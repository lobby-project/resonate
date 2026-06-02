// ============================================================
// Music Signal Engine (V1, rule-based, NO LLM)
// Input: aggregated top artists (with genres + popularity) + top tracks
// Output: one of 25 signals + the 12-category genre distribution
//
// Built only on confirmed-available Spotify data (top artists/tracks + genres + popularity).
// Expanded to cover ALL 12 big genre categories (not electronic-biased).
// ============================================================

import type { SpotifyArtist, SpotifyTrack } from "./spotify";

// ---- our 12 big music categories ----
export const GENRE_CATEGORIES = [
  "Electronic / EDM",
  "Hip-Hop / Rap",
  "Pop",
  "Rock",
  "R&B / Soul",
  "Jazz / Blues",
  "Indie / Alternative",
  "Metal / Punk",
  "Country / Folk",
  "Latin",
  "Reggae",
  "Classical / Orchestra",
] as const;
export type GenreCategory = (typeof GENRE_CATEGORIES)[number];

// Map a raw Spotify genre string to one of our 12 categories (best-effort keyword match).
function mapGenre(raw: string): GenreCategory | null {
  const g = raw.toLowerCase();
  const has = (...k: string[]) => k.some((x) => g.includes(x));

  if (has("techno","house","edm","electro","trance","dubstep","drum and bass","dnb","bass music","garage","disco","rave","big room","hardstyle","trap edm","electronic","idm","ambient","downtempo","synthwave")) return "Electronic / EDM";
  if (has("hip hop","hip-hop","rap","trap","drill","grime")) return "Hip-Hop / Rap";
  if (has("r&b","rnb","soul","neo soul","funk","motown")) return "R&B / Soul";
  if (has("jazz","blues","swing","bebop")) return "Jazz / Blues";
  if (has("metal","punk","hardcore","emo","screamo","grindcore")) return "Metal / Punk";
  if (has("indie","alternative","shoegaze","post-punk","lo-fi","dream pop")) return "Indie / Alternative";
  if (has("country","folk","americana","bluegrass","singer-songwriter")) return "Country / Folk";
  if (has("latin","reggaeton","salsa","bachata","cumbia","banda","mariachi","tango")) return "Latin";
  if (has("reggae","dancehall","ska","dub")) return "Reggae";
  if (has("classical","orchestra","opera","symphony","baroque","choral")) return "Classical / Orchestra";
  if (has("rock","metalcore","grunge","hard rock","classic rock","garage rock")) return "Rock";
  if (has("pop","k-pop","kpop","c-pop","dance pop","synth-pop","hyperpop","electropop")) return "Pop";
  return null;
}

export type SignalResult = {
  signal: string;
  genreDistribution: Record<string, number>; // category -> count
  dominantGenre: GenreCategory | null;
  avgPopularity: number;
};

// The 25 signals. Behavior > Mood > Genre priority cascade.
export function generateMusicSignal(
  artists: SpotifyArtist[],
  tracks: SpotifyTrack[]
): SignalResult {
  // ---- genre distribution across our 12 categories ----
  const dist: Record<string, number> = {};
  for (const a of artists) {
    for (const raw of a.genres ?? []) {
      const cat = mapGenre(raw);
      if (cat) dist[cat] = (dist[cat] ?? 0) + 1;
    }
  }
  const sortedGenres = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const dominantGenre = (sortedGenres[0]?.[0] as GenreCategory) ?? null;
  const distinctGenres = sortedGenres.length;

  // ---- popularity (mainstream vs underground) ----
  const pops = artists.map((a) => a.popularity).filter((n) => typeof n === "number");
  const avgPopularity = pops.length ? pops.reduce((s, n) => s + n, 0) / pops.length : 50;

  // ---- BEHAVIOR signals (highest priority) ----
  // genre hopper: very diverse taste
  if (distinctGenres >= 6) {
    return done("Genre Hopper");
  }
  // crossover curator: 4-5 genres, fairly balanced
  if (distinctGenres >= 4) {
    return done("Crossover Curator");
  }

  // ---- MOOD signals (popularity-driven) ----
  if (avgPopularity >= 70) {
    return done("Mainstream Tastemaker");
  }
  if (avgPopularity <= 35) {
    return done("Underground Devotee");
  }

  // ---- GENRE signals (fallback by dominant category) ----
  const genreSignal: Record<string, string> = {
    "Electronic / EDM": "Festival Dancer",
    "Hip-Hop / Rap": "Hip-Hop Purist",
    "Pop": "Pop Enthusiast",
    "Rock": "Rock Devotee",
    "R&B / Soul": "R&B Romanticist",
    "Jazz / Blues": "Jazz Wanderer",
    "Indie / Alternative": "Indie Explorer",
    "Metal / Punk": "Mosh Pit Veteran",
    "Country / Folk": "Folk Storyteller",
    "Latin": "Latin Music Lover",
    "Reggae": "Riddim Rider",
    "Classical / Orchestra": "Concert Hall Regular",
  };

  if (dominantGenre && genreSignal[dominantGenre]) {
    return done(genreSignal[dominantGenre]);
  }

  // ---- ultimate fallback ----
  return done("New Music Hunter");

  function done(signal: string): SignalResult {
    return { signal, genreDistribution: dist, dominantGenre, avgPopularity };
  }
}

// Full 25-signal catalog (for reference / validation).
export const ALL_SIGNALS = [
  // behavior (7)
  "Genre Hopper","Crossover Curator","New Music Hunter","Nostalgia Collector",
  "Late Night Owl","Live Show Veteran","Festival Season Specialist",
  // mood (8)
  "Mainstream Tastemaker","Underground Devotee","Melodic Explorer","High-Energy Raver",
  "Introspective Night Driver","Sunday Reset","Bedroom Producer Fan","Festival Dancer",
  // genre (10)
  "Hip-Hop Purist","Pop Enthusiast","Rock Devotee","R&B Romanticist","Jazz Wanderer",
  "Indie Explorer","Mosh Pit Veteran","Folk Storyteller","Latin Music Lover","Riddim Rider",
  // extra
  "Concert Hall Regular",
] as const;
